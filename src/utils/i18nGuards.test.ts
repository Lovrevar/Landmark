import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import hrBundle from '../locales/hr/translation.json'
import enBundle from '../locales/en/translation.json'

/**
 * Two guards over the source tree, so the English that was just swept out cannot drift back.
 *
 * These are not unit tests of a function — they are the cheapest way to hold a convention that
 * spans 600 files, and both failures are one-line fixes with an obvious message.
 */

const SRC = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : []
  })
}

/**
 * Sites that may still format an English month name, each for a reason that outlives this batch.
 * Shrink this list; do not grow it.
 */
const MONTH_NAME_ALLOWED = [
  // The date helpers themselves — 'MMM dd, yyyy' is the *English* branch.
  'utils/formatters.ts',
  // Export generators are a batch of their own (see docs/REPORTS.md: they become Croatian with an
  // embedded font). Until then their labels are English, and a date among them should match.
  'components/Reports/pdf/',
  'components/dashboards/investmentReportPdf.ts',
  // `month` is kept beside `month_key` only because the PDF builds a chart axis from
  // `month.substring(0, 3)`. Both fields are @deprecated and go with the export batch.
  'components/Reports/services/generalReportService.ts',
  'components/Reports/services/salesReportService.ts',
  // Writes `credit_name` into bank_credits — stored data, not a label. Changing it would make a
  // row's text depend on who created it, which is a product decision, not a translation.
  'components/Funding/Investors/services/equityService.ts',
]

describe('no English month names in the UI', () => {
  it('formats dates through the locale-aware helpers', () => {
    const offenders = sourceFiles(SRC)
      .map(file => ({ file: relative(SRC, file), text: readFileSync(file, 'utf8') }))
      .filter(({ file }) => !MONTH_NAME_ALLOWED.some(allowed => file.startsWith(allowed)))
      .flatMap(({ file, text }) =>
        text
          .split('\n')
          .map((line, i) => ({ line, n: i + 1 }))
          // A format string with a month *name* in it: 'MMM'/'MMMM'. Comments are not code.
          .filter(({ line }) => /['"`][^'"`]*MMM[^'"`]*['"`]/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line))
          .map(({ n }) => `${file}:${n}`),
      )

    expect(
      offenders,
      `Format dates with formatDate / formatDateTime / formatMonthYear from src/utils/formatters.ts, ` +
      `which render Croatian for a Croatian UI. Offenders:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})

// `common.months` is a string[], so a leaf is not always a string.
type Bundle = { [key: string]: string | string[] | Bundle }

function keyPaths(bundle: Bundle, prefix = ''): string[] {
  return Object.entries(bundle).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    const isBranch = typeof value === 'object' && value !== null && !Array.isArray(value)
    return isBranch ? keyPaths(value as Bundle, path) : [path]
  })
}

describe('locale files stay in step', () => {
  const hr = new Set(keyPaths(hrBundle as unknown as Bundle))
  const en = new Set(keyPaths(enBundle as unknown as Bundle))

  it('has an English value for every Croatian key, apart from the _few plural form', () => {
    // Croatian has a third plural form (2–4) that English does not, so `_few` is expected to be
    // hr-only. Everything else missing from `en` is a key that will render as a raw key path.
    const missing = [...hr].filter(key => !en.has(key) && !key.endsWith('_few')).sort()
    expect(missing, `Missing from en/translation.json:\n${missing.join('\n')}`).toEqual([])
  })

  it('has a Croatian value for every English key', () => {
    const missing = [...en].filter(key => !hr.has(key)).sort()
    expect(missing, `Missing from hr/translation.json:\n${missing.join('\n')}`).toEqual([])
  })

  it('pairs every Croatian _few form with its _one and _other', () => {
    const incomplete = [...hr]
      .filter(key => key.endsWith('_few'))
      .filter(key => {
        const stem = key.slice(0, -4)
        return !hr.has(`${stem}_one`) || !hr.has(`${stem}_other`)
      })
      .sort()
    expect(incomplete, `Incomplete Croatian plural groups:\n${incomplete.join('\n')}`).toEqual([])
  })
})
