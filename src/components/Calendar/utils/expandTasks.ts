import type { Task } from '../../../types/tasks'

export interface TaskOccurrence {
  occurrenceKey: string
  task: Task
  due_at: Date
  isOverdue: boolean
  isDone: boolean
}

function buildDueDate(dueDate: string, dueTime: string | null): Date {
  if (dueTime) {
    const [h, m] = dueTime.split(':').map(Number)
    const [y, mo, d] = dueDate.split('-').map(Number)
    return new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0, 0)
  }
  // Date-only: anchor at end-of-day local so it sorts after timed items for the day.
  const [y, mo, d] = dueDate.split('-').map(Number)
  return new Date(y, (mo || 1) - 1, d || 1, 23, 59, 0, 0)
}

export function expandTasks(
  tasks: Task[],
  windowStart: Date,
  windowEnd: Date,
): TaskOccurrence[] {
  const now = Date.now()
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()
  const out: TaskOccurrence[] = []
  for (const task of tasks) {
    if (!task.due_date) continue
    const due = buildDueDate(task.due_date, task.due_time)
    const ms = due.getTime()
    if (ms < startMs || ms > endMs) continue
    const isDone = task.status === 'done'
    out.push({
      occurrenceKey: `task:${task.id}`,
      task,
      due_at: due,
      isOverdue: !isDone && ms < now,
      isDone,
    })
  }
  out.sort((a, b) => a.due_at.getTime() - b.due_at.getTime())
  return out
}
