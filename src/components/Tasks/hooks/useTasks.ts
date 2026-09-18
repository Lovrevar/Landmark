import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
  acknowledgeAllTasks,
  createTask,
  deleteTask,
  fetchAllTasks,
  setAssignees,
  updateTask,
  updateTaskCompleted,
} from '../services/tasksService'
import { acknowledgeOpenedTask, dispatchTasksRead } from './useTasksNotifications'
import { isChecklist } from '../subtasks'
import { hasUnreadAssignment, markAssignmentRead } from '../unread'
import type { NewTaskInput, Task, UpdateTaskInput } from '../../../types/tasks'

export function useTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  // A failed fetch used to reject out of the effect and leave the page on its "no tasks"
  // empty state, which is indistinguishable from an inbox that is genuinely clear.
  const [error, setError] = useState<Error | null>(null)
  const loadedOnceRef = useRef(false)

  // Only the first load shows the spinner; mutation/realtime refreshes
  // swap the data in place so the list never blanks out.
  const load = useCallback(async () => {
    if (!user) return
    if (!loadedOnceRef.current) setLoading(true)
    setError(null)
    try {
      const data = await fetchAllTasks()
      setTasks(data)
      loadedOnceRef.current = true
    } catch (err) {
      console.error('Failed to load tasks', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // Visiting the page no longer marks everything read — that emptied the badge and wiped every
  // blue dot before anyone could see them. A task is read when it is opened (`acknowledge`), or
  // all at once through the explicit "mark all as read" (`acknowledgeAll`).

  // Optimistic, so the row's dot goes as the drawer opens rather than after the round trip. A
  // failed write reloads, which brings the dot back: the task is still unread.
  const acknowledge = useCallback(async (taskId: string) => {
    if (!user) return
    const task = tasks.find(tk => tk.id === taskId)
    if (!task || !hasUnreadAssignment(task, user.auth_user_id)) return
    const now = new Date().toISOString()
    setTasks(prev =>
      prev.map(tk => (tk.id === taskId ? markAssignmentRead(tk, user.auth_user_id, now) : tk)),
    )
    if (!(await acknowledgeOpenedTask(task, user.auth_user_id))) await load()
  }, [user, tasks, load])

  // Throws, so the button can report a failure; local state changes only once it succeeded.
  const acknowledgeAll = useCallback(async () => {
    if (!user) return
    await acknowledgeAllTasks(user.auth_user_id)
    const now = new Date().toISOString()
    setTasks(prev => prev.map(tk => markAssignmentRead(tk, user.auth_user_id, now)))
    dispatchTasksRead()
  }, [user])

  const create = useCallback(async (input: NewTaskInput) => {
    if (!user) return
    await createTask(input, user)
    await load()
  }, [user, load])

  const setCompleted = useCallback(
    async (task: Task, next: boolean) => {
      if (!user) return
      // A checklist task's completion is the trigger's to write — every checkbox in the UI
      // is disabled for one, so reaching here means a stale client (someone added the first
      // subtask while this page was open). Bail before the optimistic flip rather than show
      // a state the server is going to refuse.
      if (isChecklist(task)) return
      // optimistic flip so the checkbox reacts instantly
      setTasks(prev =>
        prev.map(t =>
          t.id === task.id
            ? { ...t, completed: next, completed_at: next ? new Date().toISOString() : null }
            : t,
        ),
      )
      try {
        await updateTaskCompleted(task.id, next, user, task.title)
      } catch (err) {
        await load() // revert to server state
        throw err
      }
      await load()
    },
    [user, load],
  )

  const toggleStatus = useCallback(
    async (task: Task) => {
      await setCompleted(task, !task.completed)
    },
    [setCompleted],
  )

  const remove = useCallback(async (task: Task) => {
    if (!user) return
    await deleteTask(task.id, user, task.title)
    await load()
  }, [user, load])

  const update = useCallback(
    async (task: Task, patch: UpdateTaskInput, assigneeIds?: string[]) => {
      if (!user) return
      if (Object.keys(patch).length > 0) {
        await updateTask(task.id, patch, user, task.title)
      }
      if (assigneeIds && !patch.is_private) {
        await setAssignees(task.id, assigneeIds, user)
      }
      await load()
    },
    [user, load],
  )

  const dismissError = useCallback(() => setError(null), [])

  return {
    tasks,
    loading,
    error,
    dismissError,
    create,
    update,
    setCompleted,
    toggleStatus,
    remove,
    acknowledge,
    acknowledgeAll,
    refresh: load,
    // Alias, so a retry button and the realtime refresh can share one name.
    refetch: load,
  }
}
