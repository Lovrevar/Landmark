import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { acknowledgeTask, getUnacknowledgedTaskCount } from '../services/tasksService'
import { hasUnreadAssignment } from '../unread'
import type { Task } from '../../../types/tasks'

export const TASKS_READ_EVENT = 'tasks:marked-read'
const POLL_INTERVAL_MS = 20_000

export function dispatchTasksRead() {
  window.dispatchEvent(new Event(TASKS_READ_EVENT))
}

/**
 * Marks a task the user has just opened as read and has the header badge recount. Shared by the
 * Tasks page and the Calendar, the two places a task's drawer opens. Makes no request at all
 * when the user has nothing unread on the task.
 *
 * Resolves to false only when the write failed. That failure is logged to the console and not
 * toasted: marking read is bookkeeping, not something the user asked for — they asked to open
 * the task, which worked — and the cost is a blue dot that stays until they next open it.
 */
export async function acknowledgeOpenedTask(
  task: Pick<Task, 'id' | 'assignees'>,
  authUserId: string | null | undefined,
): Promise<boolean> {
  if (!authUserId || !hasUnreadAssignment(task, authUserId)) return true
  try {
    await acknowledgeTask(task.id, authUserId)
  } catch (err) {
    console.error('Failed to mark task as read', err)
    return false
  }
  dispatchTasksRead()
  return true
}

export function useTasksNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const c = await getUnacknowledgedTaskCount(user.auth_user_id)
      if (mountedRef.current) setUnreadCount(c)
    } catch {
      /* ignore */
    }
  }, [user])

  useEffect(() => {
    refresh()
    const i = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(i)
  }, [refresh])

  useEffect(() => {
    const handleRead = () => refresh()
    window.addEventListener(TASKS_READ_EVENT, handleRead)
    return () => window.removeEventListener(TASKS_READ_EVENT, handleRead)
  }, [refresh])

  return { unreadCount, refresh }
}
