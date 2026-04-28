import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
  acknowledgeAllTasks,
  createTask,
  deleteTask,
  fetchMyTasks,
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

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchMyTasks(user.id)
      setTasks(data)
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
      await updateTaskStatus(task.id, next, user.id, user.role, task.title)
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
