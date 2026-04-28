import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
} from '../services/tasksService'
import type { TaskComment } from '../../../types/tasks'

export function useTaskComments(taskId: string | null) {
  const { user } = useAuth()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const data = await fetchTaskComments(taskId)
      setComments(data)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (taskId) {
      setDraft('')
      load()
    } else {
      setComments([])
    }
  }, [taskId, load])

  const send = useCallback(async () => {
    if (!user || !taskId || !draft.trim() || sending) return
    setSending(true)
    try {
      await createTaskComment(taskId, user.id, draft)
      setDraft('')
      await load()
    } finally {
      setSending(false)
    }
  }, [user, taskId, draft, sending, load])

  const remove = useCallback(async (commentId: string) => {
    if (!taskId) return
    await deleteTaskComment(commentId)
    await load()
  }, [taskId, load])

  return {
    comments,
    loading,
    draft,
    setDraft,
    sending,
    send,
    remove,
    refresh: load,
  }
}
