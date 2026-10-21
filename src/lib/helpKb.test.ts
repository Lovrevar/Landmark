import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseHelpArticle, helpGroup, isVisibleToRole, routeMatches, articlesForRoute,
  searchArticles, resolveWikiLinks, newsArticles, unseenNews,
  helpImageNames, resolveHelpImages, type HelpArticle,
} from './helpKb'

const article = (over: Partial<HelpArticle>): HelpArticle => ({
  id: 'a', title: 'A', keywords: [], routes: [], roles: [], body: 'text', ...over,
})

describe('parseHelpArticle', () => {
  const raw = [
    '---',
    'id: term-cesija',
    'title: Što je cesija?',
    'keywords: [cesija, debt assignment]',
    'routes: [/accounting-payments]',
    'roles: [Director, Accounting]',
    '---',
    '',
    '**Cesija** je…',
  ].join('\n')

  it('reads frontmatter the way the assistant index build does', () => {
    expect(parseHelpArticle('../help-kb/term-cesija.md', raw)).toEqual({
      id: 'term-cesija',
      title: 'Što je cesija?',
      keywords: ['cesija', 'debt assignment'],
      routes: ['/accounting-payments'],
      roles: ['Director', 'Accounting'],
      body: '**Cesija** je…',
    })
  })

  it('falls back to the file name for a missing id and survives CRLF', () => {
    const parsed = parseHelpArticle('help-kb/tasks.md', '---\r\ntitle: Zadaci\r\n---\r\nTekst')
    expect(parsed?.id).toBe('tasks')
    expect(parsed?.body).toBe('Tekst')
  })

  it('skips the index and assistant-only articles', () => {
    expect(parseHelpArticle('help-kb/INDEX.md', '# Index')).toBeNull()
    expect(parseHelpArticle('help-kb/x.md', '---\nid: x\nassistant_only: true\n---\nbody')).toBeNull()
  })
})

describe('the real knowledge base', () => {
  const dir = join(process.cwd(), 'help-kb')
  const articles = readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .map(file => parseHelpArticle(file, readFileSync(join(dir, file), 'utf8')))
    .filter((parsed): parsed is HelpArticle => parsed !== null)

  it('parses every article with a title and a body', () => {
    expect(articles.length).toBeGreaterThan(50)
    for (const parsed of articles) {
      expect(parsed.title, parsed.id).not.toBe(parsed.id)
      expect(parsed.body.length, parsed.id).toBeGreaterThan(0)
    }
  })

  it('has no [[link]] to an article that does not exist', () => {
    const ids = new Set(articles.map(parsed => parsed.id))
    // Assistant-only articles are still valid link targets for the assistant; on the Help page
    // such a link degrades to plain text.
    const allIds = new Set(readdirSync(dir).map(file => file.replace(/\.md$/, '')))
    for (const parsed of articles) {
      for (const match of parsed.body.matchAll(/\[\[([^\]|]+)\]\]/g)) {
        const target = match[1].trim()
        expect(ids.has(target) || allIds.has(target), `${parsed.id} → ${target}`).toBe(true)
      }
    }
  })

  it('has an article behind every id an in-app hint links to', () => {
    const ids = new Set(articles.map(parsed => parsed.id))
    const hintArticles = [
      'term-evm', 'term-invoice-types', 'term-kompenzacija', 'term-cesija', 'tic', 'funding-investments',
      'term-multi-vat', 'term-unit-types', 'term-has-contract', 'term-faza-vs-prekretnica',
      'term-realised-budget', 'term-budzet-iz-tic',
    ]
    for (const id of hintArticles) {
      expect(ids.has(id), id).toBe(true)
    }
  })
})

describe('grouping and role filter', () => {
  it('groups by the id prefixes the knowledge base uses', () => {
    expect(helpGroup(article({ id: 'term-tic' }))).toBe('terms')
    expect(helpGroup(article({ id: 'terminology-dobavljac-vs-podugovaratelj' }))).toBe('terms')
    expect(helpGroup(article({ id: 'role-profile-vs-role' }))).toBe('roles')
    expect(helpGroup(article({ id: 'tic' }))).toBe('pages')
  })

  it('shows an article with no roles to everyone, and a restricted one only to its roles', () => {
    expect(isVisibleToRole(article({ roles: [] }), 'Sales')).toBe(true)
    expect(isVisibleToRole(article({ roles: ['Director', 'Accounting'] }), 'Accounting')).toBe(true)
    expect(isVisibleToRole(article({ roles: ['Director', 'Accounting'] }), 'Sales')).toBe(false)
    expect(isVisibleToRole(article({ roles: ['Director'] }), undefined)).toBe(false)
  })

  it('also shows an article to a role that can open a page it is tagged to', () => {
    const canOpen = (role: string, route: string) => role === 'Sales' && route === '/budget-control'
    const guide = article({ roles: ['Director', 'Accounting', 'Investment'], routes: ['/budget-control'] })
    expect(isVisibleToRole(guide, 'Sales', canOpen)).toBe(true)
    expect(isVisibleToRole(guide, 'Supervision', canOpen)).toBe(false)
    // No page to go by: the roles list is all there is.
    expect(isVisibleToRole(article({ roles: ['Director'], routes: [] }), 'Sales', canOpen)).toBe(false)
  })
})

describe('routes', () => {
  it('matches exact routes, params and optional params', () => {
    expect(routeMatches('/tic', '/tic')).toBe(true)
    expect(routeMatches('/tic', '/tickets')).toBe(false)
    expect(routeMatches('/projects/:id', '/projects/42')).toBe(true)
    expect(routeMatches('/projects/:id', '/projects')).toBe(false)
    expect(routeMatches('/projects', '/projects/42')).toBe(false)
    expect(routeMatches('/site-management/:projectId?', '/site-management')).toBe(true)
    expect(routeMatches('/', '/')).toBe(true)
    expect(routeMatches('/', '/tic')).toBe(false)
  })

  it('puts the article written only about this page first', () => {
    const broad = article({ id: 'broad', routes: ['/projects', '/tic', '/budget-control'] })
    const exact = article({ id: 'exact', routes: ['/tic'] })
    const other = article({ id: 'other', routes: ['/chat'] })
    expect(articlesForRoute([broad, exact, other], '/tic').map(a => a.id)).toEqual(['exact', 'broad'])
  })
})

describe('searchArticles', () => {
  const tic = article({ id: 'tic', title: 'TIC — Struktura troškova', keywords: ['budžet projekta'], body: 'Uvoz iz Excela.' })
  const racuni = article({ id: 'racuni', title: 'Računi (Cashflow)', keywords: ['PDV'], body: 'Budžet se ne mijenja.' })

  it('returns everything for an empty query', () => {
    expect(searchArticles([tic, racuni], '  ')).toEqual([tic, racuni])
  })

  it('ignores diacritics and case', () => {
    expect(searchArticles([tic, racuni], 'RACUNI').map(a => a.id)).toEqual(['racuni'])
  })

  it('ranks a word that starts with the query above one that only contains it', () => {
    const budget = article({ id: 'budget', title: 'Kontrola proračuna (EVM)' })
    expect(searchArticles([budget, racuni], 'racun').map(a => a.id)).toEqual(['racuni', 'budget'])
  })

  it('requires every word and ranks a keyword hit above a body hit', () => {
    expect(searchArticles([racuni, tic], 'budzet').map(a => a.id)).toEqual(['tic', 'racuni'])
    expect(searchArticles([racuni, tic], 'budzet excela').map(a => a.id)).toEqual(['tic'])
    expect(searchArticles([racuni, tic], 'nepostojece')).toEqual([])
  })
})

describe('resolveWikiLinks', () => {
  it('links to articles the reader can open and leaves the rest as text', () => {
    const titles = new Map([['term-cesija', 'Što je cesija?']])
    expect(resolveWikiLinks('Vidi [[term-cesija]] i [[cashflow-unlock]].', titles))
      .toBe('Vidi [Što je cesija?](/help/term-cesija) i cashflow-unlock.')
  })
})

describe('release notes', () => {
  const note = (id: string, date?: string): HelpArticle => ({ id, title: id, keywords: [], routes: [], roles: [], body: 'x', date })

  it('reads a valid date and ignores anything else', () => {
    expect(parseHelpArticle('help-kb/news-a.md', '---\ndate: 2026-10-12\n---\nTekst')?.date).toBe('2026-10-12')
    expect(parseHelpArticle('help-kb/news-a.md', '---\ndate: listopad 2026\n---\nTekst')?.date).toBeUndefined()
  })

  it('groups by the news- prefix and lists newest first, dated notes only', () => {
    expect(helpGroup(note('news-2026-10'))).toBe('news')
    const listed = newsArticles([note('news-a', '2026-09-01'), note('tic', '2026-12-01'), note('news-b', '2026-10-12'), note('news-c')])
    expect(listed.map(article => article.id)).toEqual(['news-b', 'news-a'])
  })

  it('offers the newest note until it has been seen', () => {
    const articles = [note('news-a', '2026-09-01'), note('news-b', '2026-10-12')]
    expect(unseenNews(articles, null)?.id).toBe('news-b')
    expect(unseenNews(articles, '2026-09-01')?.id).toBe('news-b')
    expect(unseenNews(articles, '2026-10-12')).toBeNull()
    expect(unseenNews([note('tic')], null)).toBeNull()
  })

  it('every release note in the knowledge base carries a date', () => {
    const dir = join(process.cwd(), 'help-kb')
    const notes = readdirSync(dir)
      .filter(file => file.startsWith('news-') && file.endsWith('.md'))
      .map(file => parseHelpArticle(file, readFileSync(join(dir, file), 'utf8')))
    expect(notes.length).toBeGreaterThan(0)
    for (const parsed of notes) expect(parsed?.date, parsed?.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('screenshots', () => {
  const dir = join(process.cwd(), 'help-kb')
  const imgDir = join(dir, 'img')
  const files = existsSync(imgDir) ? readdirSync(imgDir).filter(file => /\.(png|jpg|webp)$/.test(file)) : []
  const referenced = new Map<string, string>()
  for (const file of readdirSync(dir).filter(name => name.endsWith('.md'))) {
    for (const name of helpImageNames(readFileSync(join(dir, file), 'utf8'))) referenced.set(name, file)
  }

  it('points a reference at the bundled file and drops one with no file', () => {
    const body = 'Prije\n\n![TIC](img/tic.png)\n\n![Nema](img/nema.png)'
    expect(helpImageNames(body)).toEqual(['tic.png', 'nema.png'])
    expect(resolveHelpImages(body, { 'tic.png': '/assets/tic-abc.png' })).toBe('Prije\n\n![TIC](/assets/tic-abc.png)\n\n')
  })

  it('has a file for every screenshot an article shows', () => {
    for (const [name, article] of referenced) expect(files, `${name} in ${article}`).toContain(name)
  })

  it('has no screenshot that no article shows', () => {
    for (const file of files) expect(referenced.has(file), file).toBe(true)
  })

  it('keeps every screenshot small enough to open on a phone connection', () => {
    for (const file of files) expect(statSync(join(imgDir, file)).size, file).toBeLessThan(300 * 1024)
  })
})
