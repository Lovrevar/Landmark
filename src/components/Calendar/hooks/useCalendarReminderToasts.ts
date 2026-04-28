import { useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../contexts/ToastContext'

interface CalendarNotificationRow {
  id: string
  event_id: string
  user_id: string
  occurrence_start_at: string
  offset_minutes: number
  title: string
  body: string | null
  acknowledged_at: string | null
  created_at: string
}

function offsetLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h`
  return `${Math.round(minutes / 1440) } d`
}

export function useCalendarReminderToasts(): void {
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`calendar_notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calendar_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          const n = payload.new as CalendarNotificationRow
          if (!n) return
          const when = new Date(n.occurrence_start_at).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })
          toast(`${n.title} · ${offsetLabel(n.offset_minutes)} · ${when}`)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, toast])
}
