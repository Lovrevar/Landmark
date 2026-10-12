import type { Locator, Page } from '@playwright/test'

export type DemoRole = 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'

/** The seeded demo accounts (docs/DEMO_ENVIRONMENT.md). */
export const DEMO_USERS: Record<DemoRole, string> = {
  Director: 'direktor@adriatic-demo.hr',
  Accounting: 'racunovodstvo@adriatic-demo.hr',
  Sales: 'prodaja@adriatic-demo.hr',
  Supervision: 'nadzor@adriatic-demo.hr',
  Investment: 'investicije@adriatic-demo.hr',
}

export interface Shot {
  /** File name under help-kb/img/; an article shows it as `![alt](img/<file>)`. */
  file: string
  role: DemoRole
  route: string
  /** The profile to be in (`localStorage.currentProfile`), when the page's menu matters. */
  profile?: string
  /** Clicks that bring the screen to the state worth showing. Reads only: writes are refused. */
  before?: (page: Page) => Promise<void>
  /** The part of the page to capture. Without it, the page's content area as the window shows it. */
  target?: (page: Page) => Locator
  /** A fixed rectangle of the window, for things that hang outside any one element (a dropdown). */
  clip?: { x: number; y: number; width: number; height: number }
  /** Leave the assistant's floating button in (it is hidden by default). */
  keepAssistantButton?: boolean
}

const dialog = (page: Page): Locator => page.getByRole('dialog').last()

const openDialog = (button: string | RegExp) => async (page: Page) => {
  await page.getByRole('button', { name: button }).first().click()
  await dialog(page).waitFor()
}

/** Picks the demo project that has contracts, payments and a TIC, so the figures are not all zero. */
const BUSY_PROJECT = 'Rezidencija Jarun'
const selectProject = async (page: Page) => {
  const select = page.locator('main select').first()
  const value = await select.locator('option', { hasText: BUSY_PROJECT }).first().getAttribute('value')
  await select.selectOption(value!)
  await page.waitForLoadState('networkidle')
}

// One or two pictures per article, of the thing the text is hardest to follow without. Every
// file here must be shown by an article (`![opis](img/<file>)`) — helpKb.test.ts checks both ways.
export const SHOTS: Shot[] = [
  { file: 'nadzorna-ploca.png', role: 'Director', route: '/' },
  { file: 'projekti.png', role: 'Director', route: '/projects' },
  {
    file: 'projekt-faze-i-ugovori.png',
    role: 'Director',
    route: '/projects',
    before: async page => {
      await page.getByText(BUSY_PROJECT).first().click()
      await page.getByRole('button', { name: 'Faze i ugovori' }).or(page.getByRole('tab', { name: 'Faze i ugovori' })).first().click()
      await page.waitForLoadState('networkidle')
    },
  },
  // The summary cards only: they are what the article walks through.
  { file: 'kontrola-proracuna.png', role: 'Director', route: '/budget-control', before: selectProject, clip: { x: 270, y: 96, width: 1010, height: 250 } },
  { file: 'tic.png', role: 'Director', route: '/tic', before: selectProject },
  { file: 'upravljanje-gradilistem.png', role: 'Director', route: '/site-management' },
  { file: 'racuni.png', role: 'Director', route: '/accounting-invoices' },
  { file: 'racun-obrazac.png', role: 'Director', route: '/accounting-invoices', before: openDialog('Novi račun'), target: dialog },
  {
    file: 'placanje-obrazac.png',
    role: 'Director',
    route: '/accounting-payments',
    before: async page => {
      await openDialog('Novo plaćanje')(page)
      // The source and cesija fields appear once an invoice is chosen. Nothing is saved.
      await dialog(page).locator('select').first().selectOption({ index: 1 })
    },
    target: dialog,
  },
  { file: 'stanovi.png', role: 'Director', route: '/apartments' },
  { file: 'stan-povezi-jedinice.png', role: 'Director', route: '/apartments', before: openDialog(/Poveži jedinice/), target: dialog },
  {
    file: 'profil-izbornik.png',
    role: 'Director',
    route: '/',
    before: async page => { await page.locator('nav').getByRole('button', { name: /General/ }).first().click() },
    clip: { x: 552, y: 0, width: 250, height: 358 },
  },
  {
    file: 'ai-asistent.png',
    role: 'Director',
    route: '/budget-control',
    keepAssistantButton: true,
    before: async page => {
      await page.getByRole('button', { name: 'AI asistent' }).click()
      await page.getByRole('dialog', { name: 'AI asistent' }).waitFor()
    },
    target: page => page.getByRole('dialog', { name: 'AI asistent' }),
  },
]
