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
  /** A search on the Help page that found nothing — what an article or a keyword is missing for. */
  | { action: 'help.search_no_results'; query: string }
  /** The empty search was handed to the AI assistant. */
  | { action: 'help.ask_assistant'; query: string }

function metadataFor(event: HelpEvent): Record<string, unknown> {
  switch (event.action) {
    case 'help.view':
      return { article_id: event.articleId ?? null, from_page: event.fromPage ?? null }
    case 'help.page_link_click':
      return { page: event.page }
    case 'help.hint_open':
      return { hint_id: event.hintId, page: event.page }
    case 'help.search_no_results':
    case 'help.ask_assistant':
      return { query: event.query }
  }
}

export function logHelpEvent(event: HelpEvent): void {
  const metadata = metadataFor(event)

  void logActivity({ action: event.action, entity: 'help', metadata, severity: 'low' })
}
