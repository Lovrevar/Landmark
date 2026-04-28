import { useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export function useTasksRealtime(userId: string | null | undefined, onChange: () => void) {
  useEffect(() => {
    if (!userId) return

    const tasksChannel = supabase
      .channel(`tasks-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        onChange,
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
        onChange,
      )
      .subscribe()

    const commentsChannel = supabase
      .channel(`task_comments-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments' },
        onChange,
      )
      .subscribe()

    const attachmentsChannel = supabase
      .channel(`task_attachments-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments' },
        onChange,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(tasksChannel)
      supabase.removeChannel(assigneesChannel)
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(attachmentsChannel)
    }
  }, [userId, onChange])
}
