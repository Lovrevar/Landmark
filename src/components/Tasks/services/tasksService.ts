import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import type {
  Task,
  TaskActor,
  TaskUser,
  NewTaskInput,
  UpdateTaskInput,
  TaskComment,
  TaskAttachment,
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
  'description_format',
  'completed_at',
  'created_at',
  'updated_at',
].join(', ')

const TASK_USER_FIELDS = 'id:auth_user_id, username, role'

const ATTACHMENT_FIELDS =
  'id, task_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, created_at'

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

  tasks.forEach(t => {
    t.creator = t.created_by ? creatorMap.get(t.created_by) : undefined
    t.assignees = (assignees || [])
      .filter(a => a.task_id === t.id)
      .map(a => ({ ...a, user: userMap.get(a.assignee_id) }))
    t.attachments = attachmentsByTask.get(t.id) || []
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

  return task
}

export async function updateTask(
  taskId: string,
  updates: UpdateTaskInput,
  actor: TaskActor,
  taskTitle?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  if (updates.completed !== undefined) {
    patch.completed_at = updates.completed ? new Date().toISOString() : null
  }
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId)
  if (error) throw error

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

