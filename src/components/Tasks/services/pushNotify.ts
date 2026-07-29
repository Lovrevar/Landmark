import { supabase } from '../../../lib/supabase'

// Web Push fan-out for the standalone mobile task app, which shares this task
// list. Cognilion only sends — it has no service worker, so nobody receives
// here. The `send-push` edge function lives in this Supabase project
// (supabase/functions/send-push) and does all the work: we hand it a task id
// and it re-reads the task with the service role to decide who to tell.

type PushEvent = 'task_assigned' | 'task_completed'

/**
 * Fire-and-forget by contract: a failed push must never fail the task write
 * that triggered it. Nothing awaits this and nothing reads the response.
 *
 * `newAssigneeIds` narrows the recipients on reassignment — the function
 * intersects it with the assignees it read itself, so it can only ever shrink
 * the set, never push to someone who isn't on the task. Omit it and every
 * current assignee is notified.
 */
export function notify(event: PushEvent, taskId: string, newAssigneeIds?: string[]): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) return

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) return

      // Sending the JWT as `apikey` too mirrors aiChatService — the function
      // authenticates from `Authorization`, but the duplicate avoids surprise
      // 401s from intermediate layers.
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event, taskId, newAssigneeIds }),
      })
    } catch (err) {
      console.warn('[push] notify failed', err)
    }
  })()
}
