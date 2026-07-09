import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
  acknowledgeAllTasks,
  createTask,
  deleteTask,
  fetchAllTasks,
  setAssignees,
  updateTask,
  updateTaskStatus,
} from '../services/tasksService'
import { dispatchTasksRead } from './useTasksNotifications'
import type { NewTaskInput, Task, TaskStatus, UpdateTaskInput } from '../../../types/tasks'

export function useTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const loadedOnceRef = useRef(false)

  // Only the first load shows the spinner; mutation/realtime refreshes
  // swap the data in place so the list never blanks out.
  const load = useCallback(async () => {
    if (!user) return
    if (!loadedOnceRef.current) setLoading(true)
    try {
      const data = await fetchAllTasks()
      setTasks(data)
      loadedOnceRef.current = true
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user) return
    acknowledgeAllTasks(user.id).then(() => dispatchTasksRead())
  }, [user])

  const create = useCallback(async (input: NewTaskInput) => {
    if (!user) return
    await createTask(input, user.id, user.role)
    await load()
  }, [user, load])

  const setStatus = useCallback(
    async (task: Task, next: TaskStatus) => {
      if (!user) return
      // optimistic flip so the checkbox reacts instantly
      setTasks(prev =>
        prev.map(t =>
          t.id === task.id
            ? { ...t, status: next, completed_at: next === 'done' ? new Date().toISOString() : null }
            : t,
        ),
      )
      try {
        await updateTaskStatus(task.id, next, user.id, user.role, task.title)
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
      const next: TaskStatus = task.status === 'done' ? 'todo' : 'done'
      await setStatus(task, next)
    },
    [setStatus],
  )

  const remove = useCallback(async (task: Task) => {
    if (!user) return
    await deleteTask(task.id, user.id, user.role, task.title)
    await load()
  }, [user, load])

  const update = useCallback(
    async (task: Task, patch: UpdateTaskInput, assigneeIds?: string[]) => {
      if (!user) return
      if (Object.keys(patch).length > 0) {
        await updateTask(task.id, patch, user.id, user.role, task.title)
      }
      if (assigneeIds && !patch.is_private) {
        await setAssignees(task.id, assigneeIds, user.id, user.role)
      }
      await load()
    },
    [user, load],
  )

  return {
    tasks,
    loading,
    create,
    update,
    setStatus,
    toggleStatus,
    remove,
    refresh: load,
  }
}
