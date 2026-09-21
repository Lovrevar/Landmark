import type { Task } from '../../types/tasks'

export type TaskTabKey = 'all' | 'assigned' | 'created' | 'private'

export interface TaskBuckets {
  all: Task[]
  assigned: Task[]
  created: Task[]
  privateTasks: Task[]
}

export interface TaskListFilters {
  /** The "Prikaži gotove" toggle. Persisted per user, so it also moves the tab counts. */
  showCompleted: boolean
  /** The search box. Transient, so it deliberately does **not** move the tab counts. */
  search: string
}

/**
 * Why a tab's list came back empty.
 *
 * `hidden_completed` is the case the tabs used to hide: the category has tasks, they are all
 * done, and "Show completed" is off — "there are no tasks in this category" was simply untrue.
 */
export type EmptyListReason = 'none' | 'hidden_completed' | 'no_search_match'

/**
 * Splits the visible tasks into the four tabs.
 *
 * A private task belongs only to its creator's Private tab: it is deliberately absent from All,
 * Assigned and Created, which is why All is not simply `tasks`.
 */
export function partitionTasks(tasks: Task[], authUserId: string | null | undefined): TaskBuckets {
  const all: Task[] = []
  const assigned: Task[] = []
  const created: Task[] = []
  const privateTasks: Task[] = []
  if (!authUserId) return { all, assigned, created, privateTasks }

  tasks.forEach(task => {
    if (task.is_private) {
      if (task.created_by === authUserId) privateTasks.push(task)
      return
    }
    all.push(task)
    if (task.created_by === authUserId) created.push(task)
    if (task.assignees?.some(a => a.assignee_id === authUserId)) assigned.push(task)
  })

  return { all, assigned, created, privateTasks }
}

/** True when the "Show completed" setting keeps this task off the list. */
export function isHiddenByShowCompleted(task: Task, showCompleted: boolean): boolean {
  return !showCompleted && !!task.completed
}

export function matchesSearch(task: Task, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return `${task.title} ${task.description ?? ''}`.toLowerCase().includes(q)
}

/** Exactly the tasks the grouped list renders. */
export function filterTasks(list: Task[], { showCompleted, search }: TaskListFilters): Task[] {
  return list.filter(task => !isHiddenByShowCompleted(task, showCompleted) && matchesSearch(task, search))
}

/**
 * What a tab's badge shows.
 *
 * It follows "Show completed" but not the search box: the tabs are how a category is switched,
 * so they must not be able to read 5 over an empty list, while a transient search emptying the
 * list is explained by the empty state instead of by silently rewriting every tab.
 */
export function tabCount(list: Task[], showCompleted: boolean): number {
  if (showCompleted) return list.length
  return list.reduce((n, task) => (task.completed ? n : n + 1), 0)
}

/** `null` when the list is not empty. */
export function emptyListReason(
  list: Task[],
  filters: TaskListFilters,
): EmptyListReason | null {
  if (filterTasks(list, filters).length > 0) return null
  if (list.length === 0) return 'none'
  if (tabCount(list, filters.showCompleted) === 0) return 'hidden_completed'
  return 'no_search_match'
}
