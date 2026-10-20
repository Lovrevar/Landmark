import { describe, it, expect } from 'vitest'
import { MAX_STARTER_QUESTIONS, PAGE_QUESTION, starterQuestions } from './starterQuestions'
import type { HelpArticle } from '../../../lib/helpKb'

const article = (over: Partial<HelpArticle>): HelpArticle => ({
  id: 'a', title: 'A', keywords: [], routes: [], roles: [], body: 'text', ...over,
})

describe('starterQuestions', () => {
  it('always offers the question about the page itself, first', () => {
    expect(starterQuestions([], '/tic')).toEqual([PAGE_QUESTION])
  })

  it('adds the articles written for the page, most specific first', () => {
    const broad = article({ id: 'broad', title: 'Što je TIC?', routes: ['/projects', '/tic', '/budget-control'] })
    const exact = article({ id: 'exact', title: 'TIC — Struktura troškova investicije', routes: ['/tic'] })
    const other = article({ id: 'other', title: 'Chat', routes: ['/chat'] })
    expect(starterQuestions([broad, exact, other], '/tic')).toEqual([
      PAGE_QUESTION,
      'Kako se koristi „TIC — Struktura troškova investicije”?',
      'Što je TIC?',
    ])
  })

  it('uses a title that is already a question as it is', () => {
    const term = article({ title: 'Što je cesija (ustup potraživanja)?', routes: ['/accounting-payments'] })
    expect(starterQuestions([term], '/accounting-payments')[1]).toBe('Što je cesija (ustup potraživanja)?')
  })

  it('asks for a glossary article that is titled as a name to be explained', () => {
    const term = article({ id: 'term-evm', title: 'EVM metrike: CPI, SPI, EAC, VAC', routes: ['/budget-control'] })
    expect(starterQuestions([term], '/budget-control')[1]).toBe('Objasni pojam „EVM metrike: CPI, SPI, EAC, VAC”')
  })

  it('never offers more than fits under the prompt, or the same question twice', () => {
    const many = Array.from({ length: 6 }, (_, i) => article({ id: `a${i}`, title: `Vodič ${i % 2}`, routes: ['/x'] }))
    const questions = starterQuestions(many, '/x')
    expect(questions).toHaveLength(MAX_STARTER_QUESTIONS)
    expect(new Set(questions).size).toBe(questions.length)
  })

  it('matches a page with a route parameter', () => {
    const details = article({ title: 'Detalji projekta', routes: ['/projects/:id'] })
    expect(starterQuestions([details], '/projects/42')).toContain('Kako se koristi „Detalji projekta”?')
  })
})
