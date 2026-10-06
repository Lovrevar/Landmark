import { parseHelpArticle, type HelpArticle } from '../../../lib/helpKb'

// Every article is bundled as raw text into this one module, which `helpArticles.ts` imports
// dynamically — so the knowledge base is a single lazy chunk rather than part of the first load
// or sixty-odd separate requests. The files themselves stay the only copy of the content.
const sources = import.meta.glob<string>('../../../../help-kb/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const HELP_ARTICLES: HelpArticle[] = Object.entries(sources)
  .map(([path, raw]) => parseHelpArticle(path, raw))
  .filter((article): article is HelpArticle => article !== null)
  .sort((a, b) => a.title.localeCompare(b.title, 'hr'))
