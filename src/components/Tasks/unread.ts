import type { Task } from '../../types/tasks'

// "Unread" on a task means: this user is assigned to it and has not opened it since.
//
// The marker is `task_assignees.acknowledged_at`, null from the moment of assignment until the
// assignee opens the task (or presses "mark all as read"). It is Cognilion's own bookkeeping —
// the mobile app never reads it (docs/SHARED_SCHEMA.md §3). Opening the /tasks page used to
// acknowledge everything, so TaskRow's blue dot lived for the ~300ms before that write landed
// and the header badge only ever said "you have been to /tasks".
//
// User ids here are AUTH user ids, as everywhere in the task tables.

/** Whether `userId` has an assignment on this task they have not opened yet. */
export function hasUnreadAssignment(
  task: Pick<Task, 'assignees'>,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false
  return (task.assignees || []).some(a => a.assignee_id === userId && a.acknowledged_at == null)
}

/**
 * The task with `userId`'s assignment marked read at `atIso`, for an optimistic update. The
 * same object comes back when there is nothing to mark, so a `map` over a list only replaces
 * the rows that changed.
 */
export function markAssignmentRead<T extends Pick<Task, 'assignees'>>(
  task: T,
  userId: string,
  atIso: string,
): T {
  if (!hasUnreadAssignment(task, userId)) return task
  return {
    ...task,
    assignees: (task.assignees || []).map(a =>
      a.assignee_id === userId && a.acknowledged_at == null ? { ...a, acknowledged_at: atIso } : a,
    ),
  }
}
