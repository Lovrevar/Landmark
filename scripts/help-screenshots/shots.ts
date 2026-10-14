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

/** `funding.investments.expand_credit_title`: the chevron that opens a credit on Funding → Investments. */
const EXPAND_CREDIT = 'Proširi kredit'

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
  {
    file: 'kontrola-proracuna.png',
    role: 'Director',
    route: '/budget-control',
    before: async page => {
      await selectProject(page)
      // The cards load after the project changes; "network idle" can come before they render.
      await page.getByText('Prognoza (EAC)').first().waitFor()
    },
    clip: { x: 270, y: 96, width: 1010, height: 250 } },
  { file: 'tic.png', role: 'Director', route: '/tic', before: selectProject },
  { file: 'upravljanje-gradilistem.png', role: 'Director', route: '/site-management' },
  {
    file: 'tic-faze.png',
    role: 'Director',
    route: '/tic',
    before: async page => {
      await selectProject(page)
      // Two phase columns, then one row's split dialog set to "by phase" — on screen only; the
      // dialog's Spremi is never clicked and writes are refused anyway.
      await page.getByRole('button', { name: 'Dodaj fazu' }).click()
      await page.getByRole('button', { name: 'Dodaj fazu' }).click()
      await page.locator('main table tbody tr').first().getByRole('button').filter({ hasText: /—|€|\d/ }).first().click()
      await dialog(page).waitFor()
      await dialog(page).getByRole('radio', { name: /Raspodjela po fazama/ }).check()
      await dialog(page).getByRole('button', { name: 'Ravnomjerno raspodijeli' }).click()
    },
    target: dialog,
  },
  { file: 'racuni.png', role: 'Director', route: '/accounting-invoices' },
  {
    file: 'kalendar-dospijeca.png',
    role: 'Director',
    route: '/accounting-calendar',
    before: async page => {
      // The demo's invoices fall due mostly in July 2026; step back to it from whatever "today" is.
      const heading = page.locator('main h3').filter({ hasText: /\d{4}/ }).first()
      await heading.waitFor()
      for (let step = 0; step < 36 && !(await heading.innerText()).includes('Srpanj 2026'); step++) {
        await page.locator('main button:has(svg.lucide-chevron-left)').first().click()
        await page.waitForTimeout(150)
      }
      await page.waitForLoadState('networkidle')
    },
  },
  { file: 'moje-firme.png', role: 'Director', route: '/accounting-companies' },
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
  {
    file: 'uvoz-stanova.png',
    role: 'Director',
    route: '/sales-projects',
    before: async page => {
      await page.getByText(BUSY_PROJECT).first().click()
      await openDialog('Uvezi iz Excela')(page)
    },
    target: dialog,
  },
  {
    file: 'investicije-namjene.png',
    role: 'Director',
    route: '/funding-credits',
    before: async page => {
      // Open credits one by one until one shows its allocations ("Namjene kredita").
      const toggles = page.locator(`main button[title="${EXPAND_CREDIT}"]`)
      for (let i = 0; i < 8; i++) {
        if (await page.getByText(/Namjene kredita/).first().isVisible().catch(() => false)) break
        if ((await toggles.count()) === 0) break
        await toggles.first().click()
        await page.waitForLoadState('networkidle')
      }
      await page.getByText(/Namjene kredita/).first().scrollIntoViewIfNeeded()
    },
    clip: { x: 270, y: 64, width: 1010, height: 736 },
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
