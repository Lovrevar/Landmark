import { isChecklist, subtaskProgress } from './subtasks'
import type { Task } from '../../types/tasks'

type Translate = (key: string, values?: Record<string, unknown>) => string

/**
 * Whether a user may change a task: its creator or one of its assignees. Mirrors the
 * "Tasks: creator or assignee can update" RLS policy, so a checkbox this returns false for
 * would have been refused by the database anyway.
 */
export function canEditTask(
  task: Pick<Task, 'created_by' | 'assignees'>,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false
  return (
    task.created_by === userId ||
    (task.assignees || []).some(a => a.assignee_id === userId)
  )
}

/**
 * State of a task's done checkbox outside the Tasks page (the calendar's task pills), with the
 * same rules TaskRow applies: a checklist task's completion follows its subtasks, and a user
 * who can't edit the task gets a read-only box that says so rather than one that silently fails.
 */
export function completionToggle(
  task: Task,
  userId: string | null | undefined,
  t: Translate,
): { disabled: boolean; title: string } {
  if (isChecklist(task)) {
    const { done, total } = subtaskProgress(task)
    return { disabled: true, title: t('tasks.subtasks.governed_tooltip', { done, total }) }
  }
  if (!canEditTask(task, userId)) {
    return { disabled: true, title: t('tasks.row.read_only') }
  }
  return {
    disabled: false,
    title: task.completed ? t('tasks.row.mark_open') : t('tasks.row.mark_done'),
  }
}
