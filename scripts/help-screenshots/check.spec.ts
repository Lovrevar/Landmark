import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { prepare, signIn } from './support'

// The in-app guidance at phone width, in dark mode and in English: `npm run help:check`.
//
// Screenshots go to docs/screenshots/guidance-phase-3/<variant>/ (gitignored; the README beside
// them is not) and every screen is checked for the faults a person would otherwise have to spot:
// a page that scrolls sideways, an element past the edge of the window, a raw i18n key, a hint
// popover outside the window or without its "more" link, and console errors. The test fails
// with the list. The pictures still need looking at — colour and wording are not checked.

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT_DIR = process.env.HELP_CHECK_OUT ?? join(ROOT, 'docs', 'screenshots', 'guidance-phase-3')

/** The demo project with contracts, payments and a TIC (see shots.ts). */
const BUSY_PROJECT = 'Rezidencija Jarun'

type Language = 'hr' | 'en'

const locales: Record<Language, Record<string, unknown>> = {
  hr: JSON.parse(readFileSync(join(ROOT, 'src/locales/hr/translation.json'), 'utf8')),
  en: JSON.parse(readFileSync(join(ROOT, 'src/locales/en/translation.json'), 'utf8')),
}

/** A string from the app's own locale file, so the steps click what the screen actually says. */
function tr(language: Language, key: string, vars: Record<string, string> = {}): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], locales[language])
  if (typeof value !== 'string') throw new Error(`no string ${key} in ${language}`)
  return value.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? '')
}

const TOP_LEVEL_KEYS = Object.keys(locales.hr)

interface Variant {
  name: string
  language: Language
  theme: 'light' | 'dark'
  viewport: { width: number; height: number }
}

const VARIANTS: Variant[] = [
  { name: 'phone-hr', language: 'hr', theme: 'light', viewport: { width: 390, height: 844 } },
  { name: 'desktop-dark-hr', language: 'hr', theme: 'dark', viewport: { width: 1280, height: 800 } },
  { name: 'desktop-en', language: 'en', theme: 'light', viewport: { width: 1280, height: 800 } },
]

/** What is wrong on the screen as it stands, in words. */
async function inspect(page: Page): Promise<string[]> {
  return page.evaluate((topLevelKeys) => {
    const problems: string[] = []
    const vw = window.innerWidth

    if (document.documentElement.scrollWidth > vw + 1) {
      problems.push(`page scrolls sideways (${document.documentElement.scrollWidth}px in ${vw}px)`)
    }

    // An element past the right edge that nothing clips: a scrolling table inside its card is
    // fine, a figure hanging off the screen is not.
    const clipped = (el: Element): boolean => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        const overflow = getComputedStyle(node).overflowX
        if (overflow !== 'visible' && node.getBoundingClientRect().right <= vw + 1) return true
      }
      return false
    }
    const offscreen = new Set<string>()
    for (const el of document.body.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0 || rect.right <= vw + 1) continue
      if (getComputedStyle(el).visibility === 'hidden' || clipped(el)) continue
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      offscreen.add(`${el.tagName.toLowerCase()} "${text}" ends at ${Math.round(rect.right)}px`)
    }
    for (const entry of [...offscreen].slice(0, 5)) problems.push(`past the edge: ${entry}`)

    // A raw key looks like `section.some_key` with a section the locale files actually have.
    const keyPattern = new RegExp(`\\b(?:${topLevelKeys.join('|')})\\.[a-z_]+(?:\\.[a-z_]+)*\\b`, 'g')
    for (const key of new Set(document.body.innerText.match(keyPattern) ?? [])) problems.push(`raw i18n key on screen: ${key}`)

    return problems
  }, TOP_LEVEL_KEYS)
}

/** The hint popover that is open: inside the window, with its link to Help. */
async function inspectHint(page: Page, language: Language): Promise<string[]> {
  const problems: string[] = []
  const panel = page.locator('[role="dialog"][aria-labelledby]').filter({ hasText: tr(language, 'help.hint.more') }).last()
  if (!(await panel.isVisible().catch(() => false))) return ['hint popover did not open, or has no "more" link']
  const box = (await panel.boundingBox())!
  const viewport = page.viewportSize()!
  if (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) {
    problems.push(`hint popover outside the window (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)})`)
  }
  return problems
}

const openHint = (page: Page, language: Language, topicKey: string) =>
  page.getByRole('button', { name: tr(language, 'help.hint.button_label', { topic: tr(language, topicKey) }) }).first().click()

const openProject = async (page: Page, language: Language, tabKey?: string) => {
  await page.goto('/projects')
  await page.getByText(BUSY_PROJECT).first().click()
  await page.waitForLoadState('networkidle')
  if (tabKey) await page.getByRole('button', { name: tr(language, tabKey) }).or(page.getByRole('tab', { name: tr(language, tabKey) })).first().click()
}

interface Screen {
  name: string
  run: (page: Page, language: Language) => Promise<void>
  /** The screen shows an open hint popover to check. */
  hint?: boolean
  /** Console errors this screen causes on purpose. */
  expectedErrors?: RegExp
}

const SCREENS: Screen[] = [
  {
    name: 'banner',
    run: async (page, language) => {
      await page.goto('/')
      await page.getByText(tr(language, 'help.whats_new.lead')).waitFor()
    },
  },
  { name: 'help-index', run: async page => { await page.goto('/help') } },
  { name: 'help-release-note', run: async page => { await page.goto('/help/news-2026-10') } },
  {
    name: 'help-article-image',
    run: async page => {
      await page.goto('/help/apartments')
      await page.locator('main img').first().scrollIntoViewIfNeeded()
    },
  },
  {
    name: 'help-empty-search',
    run: async (page, language) => {
      await page.goto('/help')
      await page.getByPlaceholder(tr(language, 'help.search_placeholder')).fill('kako naručiti pizzu')
      await page.getByRole('button', { name: tr(language, 'help.ask_assistant') }).waitFor()
    },
  },
  {
    name: 'assistant-handover',
    // The question goes to the assistant's edge function, which support.ts blocks: nothing is sent.
    expectedErrors: /Failed to load resource: net::ERR_FAILED|Failed to fetch|streamMessage/,
    run: async (page, language) => {
      await page.goto('/help')
      await page.getByPlaceholder(tr(language, 'help.search_placeholder')).fill('kako naručiti pizzu')
      await page.getByRole('button', { name: tr(language, 'help.ask_assistant') }).click()
      await page.getByRole('dialog', { name: 'AI asistent' }).getByText('kako naručiti pizzu').waitFor()
    },
  },
  {
    name: 'hint-multi-vat',
    hint: true,
    run: async (page, language) => {
      await page.goto('/accounting-invoices')
      await page.getByRole('button', { name: tr(language, 'invoices.actions.new') }).first().click()
      await openHint(page, language, 'invoices.hints.multi_vat_title')
    },
  },
  {
    name: 'hint-linked-units',
    hint: true,
    run: async (page, language) => {
      await page.goto('/apartments')
      await page.getByRole('button', { name: tr(language, 'apartments.link_units') }).first().click()
      await openHint(page, language, 'apartments.hints.link_units_title')
    },
  },
  {
    name: 'hint-no-contract-subcontractor',
    hint: true,
    run: async (page, language) => {
      await page.goto('/site-management')
      await page.getByText(BUSY_PROJECT).first().click()
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: tr(language, 'supervision.subcontractors.add') }).first().click()
      await openHint(page, language, 'common.hints.no_contract_title')
    },
  },
  {
    name: 'hint-no-contract-supplier-link',
    hint: true,
    run: async (page, language) => {
      await page.goto('/accounting-suppliers')
      await page.getByRole('button', { name: tr(language, 'suppliers.link_supplier') }).first().click()
      await openHint(page, language, 'common.hints.no_contract_title')
    },
  },
  {
    name: 'hint-phases',
    hint: true,
    run: async (page, language) => {
      await openProject(page, language, 'general_projects.tab_phases')
      await openHint(page, language, 'general_projects.hints.phases_title')
    },
  },
  {
    name: 'hint-realized',
    hint: true,
    run: async (page, language) => {
      await openProject(page, language, 'common.subcontractors')
      await openHint(page, language, 'general_projects.hints.realized_title')
    },
  },
  {
    name: 'hint-budget-from-tic',
    hint: true,
    run: async (page, language) => {
      await openProject(page, language)
      await page.getByRole('button', { name: tr(language, 'general_projects.edit_project') }).click()
      await openHint(page, language, 'general_projects.hints.budget_title')
    },
  },
]

for (const variant of VARIANTS) {
  test.describe(variant.name, () => {
    test.use({ viewport: variant.viewport, colorScheme: variant.theme, hasTouch: variant.viewport.width < 640 })

    test(`guidance as Director, ${variant.name}`, async ({ page }) => {
      const dir = join(OUT_DIR, variant.name)
      mkdirSync(dir, { recursive: true })
      const consoleErrors: string[] = []
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200))
      })
      await prepare(page, { language: variant.language, theme: variant.theme })
      await signIn(page, 'Director')

      const findings: string[] = []
      for (const screen of SCREENS) {
        await test.step(screen.name, async () => {
          try {
            await screen.run(page, variant.language)
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(400)
            await page.screenshot({ path: join(dir, `${screen.name}.png`) })
            const problems = [...(await inspect(page)), ...(screen.hint ? await inspectHint(page, variant.language) : [])]
            for (const problem of problems) findings.push(`${screen.name}: ${problem}`)
          } catch (error) {
            findings.push(`${screen.name}: could not be reached — ${String(error).split('\n')[0]}`)
            await page.screenshot({ path: join(dir, `${screen.name}-FAILED.png`) }).catch(() => undefined)
          }
          for (const error of consoleErrors.splice(0)) {
            if (!screen.expectedErrors?.test(error)) findings.push(`${screen.name}: console error: ${error}`)
          }
          await page.keyboard.press('Escape').catch(() => undefined)
          await page.keyboard.press('Escape').catch(() => undefined)
        })
      }

      writeFileSync(join(dir, 'findings.txt'), findings.join('\n') + '\n')
      expect(findings, findings.join('\n')).toEqual([])
    })
  })
}
