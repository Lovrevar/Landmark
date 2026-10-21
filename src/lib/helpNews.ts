/**
 * Which release note ("what's new") a user has already seen.
 *
 * Kept in the browser, per user, like the Tasks and Calendar view preferences: there is no
 * preferences table, and a note announced once more on a second device is a small price for not
 * adding one. Storage can be unavailable (private mode, blocked site data); then nothing is
 * remembered and the note is simply offered again.
 */
const seenKey = (userId: string): string => `help.news.seen.${userId}`

/** The date (`yyyy-mm-dd`) of the newest note this user has seen, or null. */
export function readSeenNews(userId: string): string | null {
  try {
    const value = localStorage.getItem(seenKey(userId))
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
  } catch {
    return null
  }
}

export function markNewsSeen(userId: string, date: string): void {
  try {
    localStorage.setItem(seenKey(userId), date)
  } catch {
    /* not remembered; the note is offered again */
  }
}
