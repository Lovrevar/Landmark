import { logActivity } from './activityLog'

/**
 * Usage events for the in-app guidance, written to the activity log under the `help` entity so
 * they can be read where every other event already is (General → Activity Log, category Help).
 *
 * They exist to answer one question — is the guidance being used, and where — so each carries the
 * page it happened on. Like every activity entry they are fire-and-forget and never block or fail
 * the user's action; `logActivity` leaves the dashboard cache alone for `help.*` since nothing
 * changed.
 */
type HelpEvent =
  | { action: 'help.view'; articleId?: string | null; fromPage?: string | null }
  | { action: 'help.page_link_click'; page: string }
  | { action: 'help.hint_open'; hintId: string; page: string }

export function logHelpEvent(event: HelpEvent): void {
  const metadata: Record<string, unknown> =
    event.action === 'help.view'
      ? { article_id: event.articleId ?? null, from_page: event.fromPage ?? null }
      : event.action === 'help.page_link_click'
        ? { page: event.page }
        : { hint_id: event.hintId, page: event.page }

  void logActivity({ action: event.action, entity: 'help', metadata, severity: 'low' })
}
