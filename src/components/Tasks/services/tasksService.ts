import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import { notify } from './pushNotify'
import type {
  Task,
  TaskActor,
  TaskUser,
  NewTaskInput,
  UpdateTaskInput,
  TaskComment,
  TaskAttachment,
  Subtask,
} from '../../../types/tasks'

// User columns in the task tables hold AUTH user ids (shared schema with
// the standalone mobile task app) — hence the `id:auth_user_id` aliases
// when resolving usernames from public.users.
const TASK_FIELDS = [
  'id',
  'title',
  'description',
  'created_by',
  'deadline',
  'due_time',
  'completed',
  'is_private',
  'project_id',
  'color',
  'description_format',
  'completed_at',
  'created_at',
  'updated_at',
].join(', ')

const TASK_USER_FIELDS = 'id:auth_user_id, username, role'

const ATTACHMENT_FIELDS =
  'id, task_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, created_at'

const SUBTASK_FIELDS =
  'id, task_id, title, position, completed, completed_at, created_at'

export const TASK_ATTACHMENTS_BUCKET = 'task-attachments'
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_TASK = 10

export interface ProjectOption {
  id: string
  name: string
}

export async function fetchTaskUsers(): Promise<TaskUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select(TASK_USER_FIELDS)
    .not('auth_user_id', 'is', null)
    .order('username')
  if (error) throw error
  return (data || []) as unknown as TaskUser[]
}

export async function fetchProjectOptions(): Promise<ProjectOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as ProjectOption[]
}

export async function fetchAllTasks(): Promise<Task[]> {
  // RLS scopes visibility: all public tasks + own/assigned private tasks
  const { data, error } = await supabase.from('tasks').select(TASK_FIELDS)
  if (error) throw error
  const tasks = (data || []) as unknown as Task[]
  await hydrateTaskRelations(tasks)
  return tasks.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function fetchTasksInRange(
  authUserId: string,
  fromIso: string,
  toIso: string,
): Promise<Task[]> {
  const fromDate = fromIso.slice(0, 10)
  const toDate = toIso.slice(0, 10)

  const { data: assignRows, error: aErr } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('assignee_id', authUserId)
  if (aErr) throw aErr
  const assignedIds = (assignRows || []).map(r => r.task_id)

  const { data: created, error: cErr } = await supabase
    .from('tasks')
    .select(TASK_FIELDS)
    .eq('created_by', authUserId)
    .not('deadline', 'is', null)
    .gte('deadline', fromDate)
    .lte('deadline', toDate)
  if (cErr) throw cErr

  let assigned: Task[] = []
  if (assignedIds.length > 0) {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_FIELDS)
      .in('id', assignedIds)
      .not('deadline', 'is', null)
      .gte('deadline', fromDate)
      .lte('deadline', toDate)
    if (error) throw error
    assigned = (data || []) as unknown as Task[]
  }

  const byId = new Map<string, Task>()
  ;[...(created || []), ...assigned].forEach(t =>
    byId.set((t as Task).id, t as unknown as Task),
  )
  const tasks = Array.from(byId.values())
  await hydrateTaskRelations(tasks)
  return tasks
}

async function hydrateTaskRelations(tasks: Task[]) {
  if (tasks.length === 0) return
  const ids = tasks.map(t => t.id)
  const creatorIds = [...new Set(tasks.map(t => t.created_by).filter(Boolean))] as string[]

  const [
    { data: assignees },
    { data: creators },
    { data: attachments },
    { data: commentCounts },
    { data: subtasks },
  ] = await Promise.all([
    supabase
      .from('task_assignees')
      .select('id, task_id, assignee_id, acknowledged_at, created_at')
      .in('task_id', ids),
    creatorIds.length
      ? supabase.from('users').select(TASK_USER_FIELDS).in('auth_user_id', creatorIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('task_attachments').select(ATTACHMENT_FIELDS).in('task_id', ids),
    supabase
      .from('task_comments')
      .select('task_id')
      .in('task_id', ids),
    // A separate query rather than a PostgREST embed, matching how every other relation on a
    // task is loaded here. It also means a client that reaches a database without the table
    // yet degrades to "no checklists" instead of failing the whole task query.
    supabase.from('task_subtasks').select(SUBTASK_FIELDS).in('task_id', ids),
  ])

  const userIds = [...new Set((assignees || []).map(a => a.assignee_id))]
  const { data: users } = userIds.length
    ? await supabase.from('users').select(TASK_USER_FIELDS).in('auth_user_id', userIds)
    : { data: [] as unknown[] }

  const userMap = new Map<string, TaskUser>(
    ((users || []) as unknown as TaskUser[]).map(u => [u.id, u]),
  )
  const creatorMap = new Map<string, TaskUser>(
    ((creators || []) as unknown as TaskUser[]).map(u => [u.id, u]),
  )

  const attachmentsByTask = new Map<string, TaskAttachment[]>()
  ;(attachments || []).forEach(row => {
    const a = row as TaskAttachment
    const list = attachmentsByTask.get(a.task_id) || []
    list.push(a)
    attachmentsByTask.set(a.task_id, list)
  })

  const countByTask = new Map<string, number>()
  ;(commentCounts || []).forEach(row => {
    const tid = (row as { task_id: string }).task_id
    countByTask.set(tid, (countByTask.get(tid) || 0) + 1)
  })

  // Sorted by position, then created_at: idx_task_subtasks_task is not UNIQUE (a reorder
  // rewrites every position in one statement, which a unique constraint would reject), so
  // two lines can briefly share a position and the tiebreak keeps the order stable.
  const subtasksByTask = new Map<string, Subtask[]>()
  ;(subtasks || []).forEach(row => {
    const s = row as Subtask
    const list = subtasksByTask.get(s.task_id) || []
    list.push(s)
    subtasksByTask.set(s.task_id, list)
  })
  subtasksByTask.forEach(list =>
    list.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
  )

  tasks.forEach(t => {
    t.creator = t.created_by ? creatorMap.get(t.created_by) : undefined
    t.assignees = (assignees || [])
      .filter(a => a.task_id === t.id)
      .map(a => ({ ...a, user: userMap.get(a.assignee_id) }))
    t.attachments = attachmentsByTask.get(t.id) || []
    t.subtasks = subtasksByTask.get(t.id) || []
    t.comment_count = countByTask.get(t.id) || 0
  })
}

export async function createTask(
  input: NewTaskInput,
  actor: TaskActor,
): Promise<Task> {
  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      completed: false,
      is_private: input.is_private,
      project_id: input.project_id,
      color: input.color,
      description_format: 'plain',
      created_by: actor.auth_user_id,
    })
    .select(TASK_FIELDS)
    .single()
  if (error) throw error
  const task = inserted as unknown as Task

  if (!input.is_private && input.assignee_ids.length > 0) {
    const rows = input.assignee_ids.map(uid => ({
      task_id: task.id,
      assignee_id: uid,
    }))
    const { error: aErr } = await supabase.from('task_assignees').insert(rows)
    if (aErr) throw aErr
  } else if (input.is_private) {
    await supabase.from('task_assignees').insert({
      task_id: task.id,
      assignee_id: actor.auth_user_id,
      acknowledged_at: new Date().toISOString(),
    })
  }

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.create',
    entity: 'task',
    entityId: task.id,
    projectId: task.project_id,
    metadata: {
      entity_name: task.title,
      is_private: task.is_private,
      assignee_count: input.assignee_ids.length,
    },
    severity: 'medium',
  })

  // Must come after the assignee insert above: send-push reads assignees from
  // the database, so firing any earlier would find none and notify nobody.
  // Private tasks make the creator the sole assignee, and the function drops
  // the caller from the recipients, so they would be a wasted round trip.
  if (!input.is_private && input.assignee_ids.length > 0) {
    notify('task_assigned', task.id)
  }

  return task
}

/**
 * On a checklist task `tasks.completed` belongs to the task_subtasks_sync_parent trigger,
 * so a direct write to it would be a second switch on the same lamp: the write would stick
 * and the next subtask tick would silently revert it.
 *
 * Every checkbox in the UI is disabled for checklist tasks, so this is the backstop for a
 * stale client — someone whose page was open while another user added the first subtask.
 * Throwing (rather than no-opping) is deliberate: useTasks.setCompleted reverts to server
 * state on error, which snaps the checkbox back to the truth.
 */
async function assertParentCompletionIsWritable(taskId: string): Promise<void> {
  const { count, error } = await supabase
    .from('task_subtasks')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId)
  // A missing table (schema not yet applied) leaves this a simple task — fail open, the
  // same way hydrateTaskRelations degrades to "no checklists".
  if (error) return
  if ((count || 0) > 0) {
    throw new Error('Task completion is governed by its subtasks')
  }
}

export async function updateTask(
  taskId: string,
  updates: UpdateTaskInput,
  actor: TaskActor,
  taskTitle?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  if (updates.completed !== undefined) {
    await assertParentCompletionIsWritable(taskId)
    patch.completed_at = updates.completed ? new Date().toISOString() : null
  }
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId)
  if (error) throw error

  // Completing from the edit modal. Re-opening never notifies.
  if (updates.completed === true) {
    notify('task_completed', taskId)
  }

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.update',
    entity: 'task',
    entityId: taskId,
    metadata: {
      entity_name: taskTitle,
      changed_fields: Object.keys(updates),
    },
    severity: 'medium',
  })
}

export async function updateTaskCompleted(
  taskId: string,
  completed: boolean,
  actor?: TaskActor,
  taskTitle?: string,
): Promise<void> {
  await assertParentCompletionIsWritable(taskId)

  const patch: Record<string, unknown> = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
  if (error) throw error

  // Checkbox in the list, the detail drawer, or the calendar's TaskPill.
  // Re-opening never notifies.
  if (completed) {
    notify('task_completed', taskId)
  }

  if (actor) {
    logActivity({
      userId: actor.id,
      userRole: actor.role,
      action: 'task.status_change',
      entity: 'task',
      entityId: taskId,
      metadata: { entity_name: taskTitle, status: completed ? 'done' : 'todo' },
      severity: 'low',
    })
  }
}

export async function deleteTask(
  taskId: string,
  actor?: TaskActor,
  taskTitle?: string,
): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
  if (actor) {
    logActivity({
      userId: actor.id,
      userRole: actor.role,
      action: 'task.delete',
      entity: 'task',
      entityId: taskId,
      metadata: { entity_name: taskTitle },
      severity: 'high',
    })
  }
}

export async function setAssignees(
  taskId: string,
  assigneeIds: string[],
  actor: TaskActor,
): Promise<void> {
  const { data: existing, error: eErr } = await supabase
    .from('task_assignees')
    .select('id, assignee_id')
    .eq('task_id', taskId)
  if (eErr) throw eErr

  const currentIds = new Set((existing || []).map(r => r.assignee_id))
  const nextIds = new Set(assigneeIds)

  const toAdd = assigneeIds.filter(id => !currentIds.has(id))
  const toRemove = (existing || []).filter(r => !nextIds.has(r.assignee_id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('task_assignees')
      .delete()
      .in('id', toRemove.map(r => r.id))
    if (error) throw error
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map(uid => ({ task_id: taskId, assignee_id: uid }))
    const { error } = await supabase.from('task_assignees').insert(rows)
    if (error) throw error

    // Only the people just added — send-push intersects this with the task's
    // real assignees, so it narrows the fan-out without letting us widen it.
    notify('task_assigned', taskId, toAdd)
  }

  if (toAdd.length > 0 || toRemove.length > 0) {
    logActivity({
      userId: actor.id,
      userRole: actor.role,
      action: toAdd.length > 0 ? 'task.assign' : 'task.unassign',
      entity: 'task',
      entityId: taskId,
      metadata: {
        added: toAdd,
        removed: toRemove.map(r => r.assignee_id),
      },
      severity: 'low',
    })
  }
}

export async function getUnacknowledgedTaskCount(authUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from('task_assignees')
    .select('id', { count: 'exact', head: true })
    .eq('assignee_id', authUserId)
    .is('acknowledged_at', null)
  if (error) return 0
  return count || 0
}

export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('id, task_id, user_id, comment, created_at, updated_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const comments = (data || []) as TaskComment[]
  if (comments.length === 0) return []
  const userIds = [...new Set(comments.map(c => c.user_id))]
  const { data: users } = await supabase
    .from('users')
    .select(TASK_USER_FIELDS)
    .in('auth_user_id', userIds)
  const userMap = new Map<string, TaskUser>(
    ((users || []) as unknown as TaskUser[]).map(u => [u.id, u]),
  )
  return comments.map(c => ({ ...c, user: userMap.get(c.user_id) }))
}

export async function createTaskComment(
  taskId: string,
  actor: TaskActor,
  comment: string,
): Promise<void> {
  const trimmed = comment.trim()
  if (!trimmed) return
  const { error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: actor.auth_user_id, comment: trimmed })
  if (error) throw error
  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.comment',
    entity: 'task',
    entityId: taskId,
    severity: 'low',
  })
}

export async function deleteTaskComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('task_comments').delete().eq('id', commentId)
  if (error) throw error
}

export async function acknowledgeAllTasks(authUserId: string): Promise<void> {
  await supabase
    .from('task_assignees')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('assignee_id', authUserId)
    .is('acknowledged_at', null)
}

// ----------------------------------------------------------------------------
// Subtasks (checklists)
//
// A task with no subtasks is a simple task; one with any is a checklist, and its
// `completed` is then owned by the task_subtasks_sync_parent trigger. See
// supabase/migrations/20260902110000_task_subtasks.sql and ../subtasks.ts.
// ----------------------------------------------------------------------------

export async function listSubtasks(taskId: string): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from('task_subtasks')
    .select(SUBTASK_FIELDS)
    .eq('task_id', taskId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as unknown as Subtask[]
}

async function readTaskCompleted(taskId: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('completed')
    .eq('id', taskId)
    .maybeSingle()
  if (error) throw error
  return data ? (data as { completed: boolean }).completed : null
}

/**
 * Serialises **every** subtask write per task id, so none of the read-decide-write cycles
 * below can interleave. Correctness lives here rather than in the component: SubtaskList's
 * `busy` flag is React state, and two taps inside a single render both read it as false.
 *
 * The UI ticks optimistically and does not wait on this, so a run of fast taps still feels
 * instant; what queues is the network work behind them. Without it, two concurrent ticks on
 * a 4-of-6 checklist both read `completed = false` before writing and both read `true` after,
 * so both believe they were the one that closed the task and both fire a push.
 */
const subtaskWriteQueue = new Map<string, Promise<unknown>>()

function queuePerTask<T>(taskId: string, op: () => Promise<T>): Promise<T> {
  const tail = subtaskWriteQueue.get(taskId) ?? Promise.resolve()
  const next = tail.then(op, op) // a failed predecessor must not cancel what follows
  // Park a swallowed copy as the new tail: an unhandled rejection here would surface as a
  // stray console error long after the caller has already handled its own.
  subtaskWriteQueue.set(
    taskId,
    next.catch(() => undefined),
  )
  return next
}

/**
 * Ticks or un-ticks one line. Returns the parent's completion state afterwards.
 *
 * The parent flip is done by a database trigger, but the `task_completed` push is
 * fired from the client — send-push is only ever called from here or from the cron
 * dispatcher, never by a trigger. So completing a task by ticking its last line has
 * to be noticed here, or it would notify nobody. Re-opening never notifies, matching
 * updateTask/updateTaskCompleted.
 */
export function setSubtaskCompleted(
  taskId: string,
  subtaskId: string,
  completed: boolean,
  actor: TaskActor,
  taskTitle?: string,
  subtaskTitle?: string,
): Promise<boolean> {
  return queuePerTask(taskId, () =>
    writeSubtaskCompleted(taskId, subtaskId, completed, actor, taskTitle, subtaskTitle),
  )
}

async function writeSubtaskCompleted(
  taskId: string,
  subtaskId: string,
  completed: boolean,
  actor: TaskActor,
  taskTitle?: string,
  subtaskTitle?: string,
): Promise<boolean> {
  // Only a tick can complete the parent — un-ticking can only reopen it — so the
  // before-read is paid for on ticks alone.
  const wasCompleted = completed ? await readTaskCompleted(taskId) : null

  const { error } = await supabase
    .from('task_subtasks')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', subtaskId)
  if (error) throw error

  let parentCompleted = false
  if (completed) {
    parentCompleted = (await readTaskCompleted(taskId)) === true
    if (parentCompleted && !wasCompleted) {
      notify('task_completed', taskId)
    }
  }

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.subtask_toggle',
    entity: 'task',
    entityId: taskId,
    metadata: {
      entity_name: taskTitle,
      subtask_name: subtaskTitle,
      status: completed ? 'done' : 'todo',
    },
    severity: 'low',
  })

  return parentCompleted
}

export function addSubtask(
  taskId: string,
  title: string,
  position: number,
  actor: TaskActor,
  taskTitle?: string,
): Promise<Subtask> {
  return queuePerTask(taskId, () => writeAddSubtask(taskId, title, position, actor, taskTitle))
}

async function writeAddSubtask(
  taskId: string,
  title: string,
  position: number,
  actor: TaskActor,
  taskTitle?: string,
): Promise<Subtask> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Subtask title cannot be empty')

  const { data, error } = await supabase
    .from('task_subtasks')
    .insert({ task_id: taskId, title: trimmed, position })
    .select(SUBTASK_FIELDS)
    .single()
  if (error) throw error
  const subtask = data as unknown as Subtask

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.subtask_add',
    entity: 'task',
    entityId: taskId,
    metadata: { entity_name: taskTitle, subtask_name: subtask.title },
    severity: 'medium',
  })

  return subtask
}

export function renameSubtask(
  taskId: string,
  subtaskId: string,
  title: string,
  actor: TaskActor,
  taskTitle?: string,
): Promise<void> {
  return queuePerTask(taskId, () =>
    writeRenameSubtask(taskId, subtaskId, title, actor, taskTitle),
  )
}

async function writeRenameSubtask(
  taskId: string,
  subtaskId: string,
  title: string,
  actor: TaskActor,
  taskTitle?: string,
): Promise<void> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Subtask title cannot be empty')

  const { error } = await supabase
    .from('task_subtasks')
    .update({ title: trimmed })
    .eq('id', subtaskId)
  if (error) throw error

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.subtask_rename',
    entity: 'task',
    entityId: taskId,
    metadata: { entity_name: taskTitle, subtask_name: trimmed },
    severity: 'low',
  })
}

/**
 * Rewrites every position from the given order. Separate statements rather than an
 * upsert: an upsert would have to send `completed` back, and a stale value there would
 * un-tick somebody's line. Only `position` is touched, so the trigger (which watches
 * UPDATE OF completed) does not fire.
 */
export function reorderSubtasks(
  taskId: string,
  orderedIds: string[],
  actor: TaskActor,
  taskTitle?: string,
): Promise<void> {
  return queuePerTask(taskId, () => writeReorderSubtasks(taskId, orderedIds, actor, taskTitle))
}

async function writeReorderSubtasks(
  taskId: string,
  orderedIds: string[],
  actor: TaskActor,
  taskTitle?: string,
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('task_subtasks')
      .update({ position: i })
      .eq('id', orderedIds[i])
    if (error) throw error
  }

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.subtask_reorder',
    entity: 'task',
    entityId: taskId,
    metadata: { entity_name: taskTitle, count: orderedIds.length },
    severity: 'low',
  })
}

export function deleteSubtask(
  taskId: string,
  subtaskId: string,
  actor: TaskActor,
  taskTitle?: string,
  subtaskTitle?: string,
): Promise<void> {
  return queuePerTask(taskId, () =>
    writeDeleteSubtask(taskId, subtaskId, actor, taskTitle, subtaskTitle),
  )
}

async function writeDeleteSubtask(
  taskId: string,
  subtaskId: string,
  actor: TaskActor,
  taskTitle?: string,
  subtaskTitle?: string,
): Promise<void> {
  const { error } = await supabase.from('task_subtasks').delete().eq('id', subtaskId)
  if (error) throw error

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.subtask_delete',
    entity: 'task',
    entityId: taskId,
    metadata: { entity_name: taskTitle, subtask_name: subtaskTitle },
    severity: 'medium',
  })
}

// ----------------------------------------------------------------------------
// Attachments
// ----------------------------------------------------------------------------

export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select(ATTACHMENT_FIELDS)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as TaskAttachment[]
}

export async function uploadTaskAttachment(
  taskId: string,
  file: File,
  actor: TaskActor,
): Promise<TaskAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`File exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB limit`)
  }
  const existing = await listTaskAttachments(taskId)
  if (existing.length >= MAX_ATTACHMENTS_PER_TASK) {
    throw new Error(`Maximum ${MAX_ATTACHMENTS_PER_TASK} attachments per task`)
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${taskId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('task_attachments')
    .insert({
      task_id: taskId,
      uploaded_by: actor.auth_user_id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select(ATTACHMENT_FIELDS)
    .single()
  if (error) {
    await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).remove([storagePath])
    throw error
  }

  const row = data as TaskAttachment
  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.attachment_add',
    entity: 'task',
    entityId: taskId,
    metadata: { file_name: row.file_name, size_bytes: row.size_bytes },
    severity: 'low',
  })
  return row
}

export async function deleteTaskAttachment(
  attachmentId: string,
  actor: TaskActor,
): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('task_attachments')
    .select(ATTACHMENT_FIELDS)
    .eq('id', attachmentId)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!row) return
  const attachment = row as TaskAttachment

  const { error } = await supabase.from('task_attachments').delete().eq('id', attachmentId)
  if (error) throw error

  await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .remove([attachment.storage_path])

  logActivity({
    userId: actor.id,
    userRole: actor.role,
    action: 'task.attachment_remove',
    entity: 'task',
    entityId: attachment.task_id,
    metadata: { file_name: attachment.file_name },
    severity: 'low',
  })
}

export function getAttachmentSignedUrl(storagePath: string, expiresInSeconds = 3600) {
  return supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
}

