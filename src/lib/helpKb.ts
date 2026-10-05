/**
 * The help articles in `help-kb/*.md`, as the in-app Help page reads them.
 *
 * `help-kb/` is the single source: the AI assistant gets the same files through
 * `scripts/build-help-kb-index.mjs`, and the frontmatter rules here mirror that script on purpose —
 * an article that parses differently for the page and for the assistant would be two sources
 * again. Everything in this file is pure so it can be tested without Vite or a browser.
 */

export interface HelpArticle {
  id: string
  title: string
  keywords: string[]
  /** Route patterns the article is about, as in `src/App.tsx` (`/projects/:id`). */
  routes: string[]
  /** Roles the article is written for. Empty means everyone. */
  roles: string[]
  body: string
}

export type HelpGroup = 'pages' | 'terms' | 'roles'

/**
 * Frontmatter flag that keeps an article out of the Help page while leaving it available to the
 * assistant — for notes about stored values and other things a user never sees on screen.
 */
const ASSISTANT_ONLY_FLAG = 'assistant_only'

type Frontmatter = Record<string, string | string[]>

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const text = raw.replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) return { frontmatter: {}, body: text }
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) return { frontmatter: {}, body: text }

  const frontmatter: Frontmatter = {}
  for (const line of text.slice(4, end).split('\n')) {
    const match = line.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (!match) continue
    const value = match[2].trim()
    frontmatter[match[1]] =
      value.startsWith('[') && value.endsWith(']')
        ? value.slice(1, -1).split(',').map(part => part.trim()).filter(Boolean)
        : value
  }
  return { frontmatter, body: text.slice(end + 5).trim() }
}

const asList = (value: string | string[] | undefined): string[] => (Array.isArray(value) ? value : [])

/**
 * One article from a raw markdown file, or `null` for a file the Help page does not show: the
 * index, an empty body, or an article flagged `assistant_only: true`.
 */
export function parseHelpArticle(fileName: string, raw: string): HelpArticle | null {
  const baseName = fileName.replace(/^.*\//, '').replace(/\.md$/, '')
  if (baseName === 'INDEX') return null

  const { frontmatter, body } = parseFrontmatter(raw)
  if (!body) return null
  if (frontmatter[ASSISTANT_ONLY_FLAG] === 'true') return null

  const id = typeof frontmatter.id === 'string' && frontmatter.id ? frontmatter.id : baseName
  return {
    id,
    title: typeof frontmatter.title === 'string' && frontmatter.title ? frontmatter.title : id,
    keywords: asList(frontmatter.keywords),
    routes: asList(frontmatter.routes),
    roles: asList(frontmatter.roles),
    body,
  }
}

/** Glossary and role explainers are told apart by the id prefix the knowledge base already uses. */
export function helpGroup(article: HelpArticle): HelpGroup {
  if (article.id.startsWith('term-') || article.id.startsWith('terminology-')) return 'terms'
  if (article.id.startsWith('role-')) return 'roles'
  return 'pages'
}

/** An article with no `roles` is for everyone; otherwise only for the roles it names. */
export function isVisibleToRole(article: HelpArticle, role: string | null | undefined): boolean {
  if (article.roles.length === 0) return true
  return !!role && article.roles.includes(role)
}

const segments = (path: string): string[] => path.split('/').filter(Boolean)

/** Whether a route pattern (`/projects/:id`, `/site-management/:projectId?`) matches a pathname. */
export function routeMatches(pattern: string, pathname: string): boolean {
  const patternParts = segments(pattern)
  const pathParts = segments(pathname)
  if (pathParts.length > patternParts.length) return false
  return patternParts.every((part, index) => {
    const actual = pathParts[index]
    if (part.startsWith(':')) return actual !== undefined || part.endsWith('?')
    return part === actual
  })
}

/**
 * The articles written about a page, most specific first: one that names only this route is
 * about the page, one that lists six routes merely applies to it.
 */
export function articlesForRoute(articles: HelpArticle[], pathname: string): HelpArticle[] {
  return articles
    .filter(article => article.routes.some(route => routeMatches(route, pathname)))
    .sort((a, b) => a.routes.length - b.routes.length)
}

/** Lowercase with Croatian diacritics folded, so "racun" finds "račun". */
export const foldText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

/**
 * Articles containing every word of the query, best match first. A word found in the title
 * outranks one in the keywords, which outranks one in the body. An empty query returns the
 * articles unchanged.
 */
export function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return articles

  const scored: { article: HelpArticle; score: number }[] = []
  for (const article of articles) {
    const title = foldText(article.title)
    const keywords = foldText(article.keywords.join(' '))
    const body = foldText(article.body)
    let score = 0
    for (const word of words) {
      if (title.includes(word)) score += 5
      else if (keywords.includes(word)) score += 3
      else if (body.includes(word)) score += 1
      else {
        score = -1
        break
      }
    }
    if (score > 0) scored.push({ article, score })
  }
  return scored.sort((a, b) => b.score - a.score).map(entry => entry.article)
}

export const helpArticlePath = (id: string): string => `/help/${encodeURIComponent(id)}`

/**
 * Turns the knowledge base's `[[article-id]]` references into markdown links to the Help page.
 * A reference to an article the reader cannot open — unknown, or written for another role — is
 * left as plain text rather than as a link that leads nowhere.
 */
export function resolveWikiLinks(body: string, linkable: ReadonlyMap<string, string>): string {
  return body.replace(/\[\[([^\]|]+)\]\]/g, (_match, rawId: string) => {
    const id = rawId.trim()
    const title = linkable.get(id)
    return title ? `[${title}](${helpArticlePath(id)})` : id
  })
}
