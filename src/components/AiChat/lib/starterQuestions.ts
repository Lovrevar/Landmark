import { articlesForRoute, helpGroup, type HelpArticle } from '../../../lib/helpKb'

/**
 * The questions offered in an empty assistant panel, chosen for the page the user is on.
 *
 * The assistant answers "how do I…" from the same help articles the Help page shows, and it is
 * told the current route with every message. So the most useful opening questions are the ones
 * those articles can answer: one about the page as a whole, then one per article written for it.
 * A title that is already a question ("Što je cesija …?") is used as it is; any other title is a
 * name, so it is quoted inside a question — "how is it used" for a page, "explain" for a term.
 *
 * Croatian only, like the rest of the assistant (docs/AI_CHAT.md).
 */
export const PAGE_QUESTION = 'Što mogu raditi na ovoj stranici?'

export const MAX_STARTER_QUESTIONS = 3

const asQuestion = (article: HelpArticle): string => {
  const title = article.title.trim()
  if (title.endsWith('?')) return title
  return helpGroup(article) === 'terms' ? `Objasni pojam „${title}”` : `Kako se koristi „${title}”?`
}

export function starterQuestions(articles: readonly HelpArticle[], pathname: string): string[] {
  const forPage = articlesForRoute([...articles], pathname).map(asQuestion)
  // The page question first; then the page's own articles, most specific first. A page with no
  // article still gets the one question — the assistant can describe any screen from its route.
  return [...new Set([PAGE_QUESTION, ...forPage])].slice(0, MAX_STARTER_QUESTIONS)
}
