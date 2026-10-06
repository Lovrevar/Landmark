import type { HelpArticle } from '../../../lib/helpKb'

let pending: Promise<HelpArticle[]> | null = null

/**
 * Every help article, loaded once per session. Throws when the chunk cannot be fetched (offline,
 * or a deploy replaced it under an open tab); the failed attempt is not cached, so a retry works.
 */
export function loadHelpArticles(): Promise<HelpArticle[]> {
  if (!pending) {
    pending = import('./helpArticleSource')
      .then(module => module.HELP_ARTICLES)
      .catch((error: unknown) => {
        pending = null
        throw error
      })
  }
  return pending
}
