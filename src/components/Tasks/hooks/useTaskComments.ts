import { useCallback, useEffect, useRef, useState } from 'react'
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
  // `sending` is read from the render closure, so two calls dispatched by one event both see
  // false. The ref is what actually stops a second insert of the same draft.
  const sendingRef = useRef(false)

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
    if (!user || !taskId || !draft.trim() || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    try {
      await createTaskComment(taskId, user, draft)
      setDraft('')
      await load()
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [user, taskId, draft, load])

  const remove = useCallback(async (commentId: string) => {
    if (!taskId || !user) return
    await deleteTaskComment(commentId, user)
    await load()
  }, [taskId, user, load])

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
