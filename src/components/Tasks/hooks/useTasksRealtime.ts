import { useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'

const REFRESH_DEBOUNCE_MS = 300

export function useTasksRealtime(userId: string | null | undefined, onChange: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!userId) return

    // Visibility is org-wide now, so the unfiltered channels fire for
    // everyone's edits — coalesce bursts into a single refetch.
    const debouncedChange = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(onChange, REFRESH_DEBOUNCE_MS)
    }

    const tasksChannel = supabase
      .channel(`tasks-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        debouncedChange,
      )
      .subscribe()

    const assigneesChannel = supabase
      .channel(`task_assignees-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignees',
          filter: `user_id=eq.${userId}`,
        },
        debouncedChange,
      )
      .subscribe()

    const commentsChannel = supabase
      .channel(`task_comments-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments' },
        debouncedChange,
      )
      .subscribe()

    const attachmentsChannel = supabase
      .channel(`task_attachments-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments' },
        debouncedChange,
      )
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(tasksChannel)
      supabase.removeChannel(assigneesChannel)
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(attachmentsChannel)
    }
  }, [userId, onChange])
}
