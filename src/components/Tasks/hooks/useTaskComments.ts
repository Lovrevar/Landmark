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
  // A failed fetch rendered the drawer's "no comments yet" line, which is a different
  // statement from "we could not read them".
  const [error, setError] = useState<Error | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  // `sending` is read from the render closure, so two calls dispatched by one event both see
  // false. The ref is what actually stops a second insert of the same draft.
  const sendingRef = useRef(false)

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTaskComments(taskId)
      setComments(data)
    } catch (e) {
      console.error('Failed to load task comments', e)
      setError(e instanceof Error ? e : new Error(String(e)))
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

  /**
   * Posts the draft. Returns false when the insert failed; the caller tells the user.
   * The draft is kept on failure, so a rejected comment is not lost.
   */
  const send = useCallback(async (): Promise<boolean> => {
    if (!user || !taskId || !draft.trim() || sendingRef.current) return false
    sendingRef.current = true
    setSending(true)
    try {
      await createTaskComment(taskId, user, draft)
      setDraft('')
      await load()
      return true
    } catch (e) {
      console.error('Failed to create task comment', e)
      return false
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [user, taskId, draft, load])

  /** Deletes one comment. Returns false when the delete failed; the caller tells the user. */
  const remove = useCallback(async (commentId: string): Promise<boolean> => {
    if (!taskId || !user) return false
    try {
      await deleteTaskComment(commentId, user)
    } catch (e) {
      console.error('Failed to delete task comment', e)
      return false
    }
    try {
      await load()
    } catch (e) {
      // The delete went through; a failed reload only leaves the list stale until realtime refreshes it.
      console.error('Failed to reload task comments', e)
    }
    return true
  }, [taskId, user, load])

  return {
    comments,
    loading,
    error,
    draft,
    setDraft,
    sending,
    send,
    remove,
    refresh: load,
  }
}
