import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import type { Task, TaskUser, NewTaskInput, TaskStatus, TaskComment } from '../../../types/tasks'

const TASK_FIELDS = 'id, title, description, created_by, due_date, due_time, status, priority, is_private, completed_at, created_at, updated_at'

export async function fetchTaskUsers(): Promise<TaskUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role')
    .order('username')
  if (error) throw error
  return data || []
}

export async function fetchMyTasks(userId: string): Promise<Task[]> {
  const { data: assignRows, error: aErr } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('user_id', userId)
  if (aErr) throw aErr

  const assignedTaskIds = (assignRows || []).map(r => r.task_id)

  const { data: created, error: cErr } = await supabase
    .from('tasks')
    .select(TASK_FIELDS)
    .eq('created_by', userId)
  if (cErr) throw cErr

  let assignedTasks: Task[] = []
  if (assignedTaskIds.length > 0) {
    const { data: assigned, error: aErr2 } = await supabase
      .from('tasks')
      .select(TASK_FIELDS)
      .in('id', assignedTaskIds)
    if (aErr2) throw aErr2
    assignedTasks = (assigned || []) as Task[]
  }

  const byId = new Map<string, Task>()
  ;[...(created || []), ...assignedTasks].forEach(t => byId.set(t.id, t as Task))

  const tasks = Array.from(byId.values())
  await hydrateTaskRelations(tasks)
  return tasks.sort((a, b) => (b.created_at).localeCompare(a.created_at))
}

async function hydrateTaskRelations(tasks: Task[]) {
  if (tasks.length === 0) return
  const ids = tasks.map(t => t.id)
  const creatorIds = [...new Set(tasks.map(t => t.created_by))]

  const [{ data: assignees }, { data: creators }] = await Promise.all([
    supabase
      .from('task_assignees')
      .select('id, task_id, user_id, acknowledged_at, created_at')
      .in('task_id', ids),
    supabase
      .from('users')
      .select('id, username, role')
      .in('id', creatorIds),
  ])

  const userIds = [...new Set((assignees || []).map(a => a.user_id))]
  const { data: users } = userIds.length
    ? await supabase.from('users').select('id, username, role').in('id', userIds)
    : { data: [] as TaskUser[] }

  const userMap = new Map<string, TaskUser>((users || []).map(u => [u.id, u]))
  const creatorMap = new Map<string, TaskUser>((creators || []).map(u => [u.id, u]))

  tasks.forEach(t => {
    t.creator = creatorMap.get(t.created_by)
    t.assignees = (assignees || [])
      .filter(a => a.task_id === t.id)
      .map(a => ({ ...a, user: userMap.get(a.user_id) }))
  })
}

export async function createTask(input: NewTaskInput, userId: string): Promise<Task> {
  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description,
      due_date: input.due_date,
      due_time: input.due_time,
      priority: input.priority,
      is_private: input.is_private,
      created_by: userId,
    })
    .select(TASK_FIELDS)
    .single()
  if (error) throw error

  if (!input.is_private && input.assignee_ids.length > 0) {
    const rows = input.assignee_ids.map(uid => ({
      task_id: inserted.id,
      user_id: uid,
    }))
    const { error: aErr } = await supabase.from('task_assignees').insert(rows)
    if (aErr) throw aErr
  } else if (input.is_private) {
    await supabase.from('task_assignees').insert({
      task_id: inserted.id,
      user_id: userId,
      acknowledged_at: new Date().toISOString(),
    })
  }

  logActivity({
    action: 'task.create',
    entity: 'task',
    entityId: inserted.id,
    severity: 'medium',
    metadata: {
      entity_name: input.title,
      priority: input.priority,
      is_private: input.is_private,
      assignee_count: input.is_private ? 1 : input.assignee_ids.length,
    },
  })

  return inserted as Task
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  taskTitle?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'done') patch.completed_at = new Date().toISOString()
  else patch.completed_at = null

  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
  if (error) throw error

  logActivity({
    action: 'task.status_change',
    entity: 'task',
    entityId: taskId,
    severity: 'medium',
    metadata: {
      entity_name: taskTitle,
      status,
      changed_fields: Object.keys(patch),
    },
  })
}

export async function deleteTask(taskId: string, taskTitle?: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error

  logActivity({
    action: 'task.delete',
    entity: 'task',
    entityId: taskId,
    severity: 'high',
    metadata: { entity_name: taskTitle },
  })
}

export async function getUnacknowledgedTaskCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('task_assignees')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
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
    .select('id, username, role')
    .in('id', userIds)
  const userMap = new Map<string, TaskUser>((users || []).map(u => [u.id, u]))
  return comments.map(c => ({ ...c, user: userMap.get(c.user_id) }))
}

export async function createTaskComment(taskId: string, userId: string, comment: string): Promise<void> {
  const trimmed = comment.trim()
  if (!trimmed) return
  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: userId, comment: trimmed })
    .select('id')
    .maybeSingle()
  if (error) throw error

  logActivity({
    action: 'task_comment.create',
    entity: 'task_comment',
    entityId: data?.id ?? null,
    severity: 'low',
    metadata: { task_id: taskId },
  })
}

export async function deleteTaskComment(commentId: string, taskId?: string): Promise<void> {
  const { error } = await supabase.from('task_comments').delete().eq('id', commentId)
  if (error) throw error

  logActivity({
    action: 'task_comment.delete',
    entity: 'task_comment',
    entityId: commentId,
    severity: 'medium',
    metadata: { task_id: taskId },
  })
}

export async function acknowledgeAllTasks(userId: string): Promise<void> {
  const { data } = await supabase
    .from('task_assignees')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('acknowledged_at', null)
    .select('id')

  const count = data?.length ?? 0
  if (count > 0) {
    logActivity({
      action: 'task.acknowledge_all',
      entity: 'task',
      severity: 'low',
      metadata: { count },
    })
  }
}
