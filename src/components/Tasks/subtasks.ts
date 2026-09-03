// Derived facts about a task's checklist.
//
// A task's *kind* is not stored anywhere: zero subtasks means a simple task, one or more
// means a checklist. There is no `kind` column on purpose — it would be a second source of
// truth that can drift from the rows it describes, and every read site would then have to
// decide which of the two to believe. These two functions are the only place that decision
// is made, so it is made the same way everywhere.
//
// The consequence that matters to the UI: on a checklist task, `tasks.completed` is written
// by a database trigger when the last line is ticked (and unwritten when one is un-ticked).
// The parent checkbox is therefore a readout, not a control, and every site that offers one —
// TaskRow, TaskDetail, the Calendar's TaskPill — disables it when isChecklist() is true.
// Leaving it live would wire two switches to one lamp: the click would stick, and the next
// subtask tick would silently revert it.

import type { Task } from '../../types/tasks'

export function isChecklist(task: Task): boolean {
  return (task.subtasks?.length ?? 0) > 0
}

export interface SubtaskProgress {
  done: number
  total: number
}

export function subtaskProgress(task: Task): SubtaskProgress {
  const subtasks = task.subtasks ?? []
  return {
    done: subtasks.filter(s => s.completed).length,
    total: subtasks.length,
  }
}
