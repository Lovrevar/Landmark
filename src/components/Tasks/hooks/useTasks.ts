import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
  acknowledgeAllTasks,
  createTask,
  deleteTask,
  fetchMyTasks,
  updateTaskStatus,
} from '../services/tasksService'
import { dispatchTasksRead } from './useTasksNotifications'
import type { NewTaskInput, Task } from '../../../types/tasks'

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

  const { assigned, created, privateTasks } = useMemo(() => {
    if (!user) return { assigned: [] as Task[], created: [] as Task[], privateTasks: [] as Task[] }
    const assignedList: Task[] = []
    const createdList: Task[] = []
    const privateList: Task[] = []
    tasks.forEach(t => {
      if (t.is_private && t.created_by === user.id) privateList.push(t)
      else if (t.created_by === user.id) createdList.push(t)
      if (!t.is_private && t.assignees?.some(a => a.user_id === user.id)) assignedList.push(t)
    })
    return { assigned: assignedList, created: createdList, privateTasks: privateList }
  }, [tasks, user])

  const create = useCallback(async (input: NewTaskInput) => {
    if (!user) return
    await createTask(input, user.id)
    await load()
  }, [user, load])

  const toggleStatus = useCallback(async (task: Task) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    await updateTaskStatus(task.id, next)
    await load()
  }, [load])

  const remove = useCallback(async (task: Task) => {
    await deleteTask(task.id)
    await load()
  }, [load])

  return {
    tasks,
    assigned,
    created,
    privateTasks,
    loading,
    create,
    toggleStatus,
    remove,
    refresh: load,
  }
}
