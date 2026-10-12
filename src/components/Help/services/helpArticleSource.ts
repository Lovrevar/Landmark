import { parseHelpArticle, resolveHelpImages, type HelpArticle } from '../../../lib/helpKb'

// Every article is bundled as raw text into this one module, which `helpArticles.ts` imports
// dynamically — so the knowledge base is a single lazy chunk rather than part of the first load
// or sixty-odd separate requests. The files themselves stay the only copy of the content.
const sources = import.meta.glob<string>('../../../../help-kb/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// The screenshots the articles show. Only their addresses are bundled here; each file is fetched
// when an article that shows it is opened.
const imageUrls = import.meta.glob<string>('../../../../help-kb/img/*.{png,jpg,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
})
const imageUrlByName: Record<string, string> = Object.fromEntries(
  Object.entries(imageUrls).map(([path, url]) => [path.replace(/^.*\//, ''), url]),
)

export const HELP_ARTICLES: HelpArticle[] = Object.entries(sources)
  .map(([path, raw]) => parseHelpArticle(path, raw))
  .filter((article): article is HelpArticle => article !== null)
  .map(article => ({ ...article, body: resolveHelpImages(article.body, imageUrlByName) }))
  .sort((a, b) => a.title.localeCompare(b.title, 'hr'))
