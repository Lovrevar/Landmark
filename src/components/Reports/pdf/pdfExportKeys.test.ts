import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import hr from '../../../locales/hr/translation.json'
import en from '../../../locales/en/translation.json'
import { getCreditTypeLabelKey } from '../../Funding/Investors/utils/creditCalculations'

/**
 * Every i18n key the PDF generators ask for must exist in the Croatian bundle.
 *
 * A missing key on a screen is a visible eyesore someone reports within the hour. A missing key
 * in an export is a raw `reports.sales.report_period` printed into a document that has already
 * left the building — so this reads the generators' source and resolves each key against the
 * shipped bundle. Source-scanning rather than importing them, because the generators pull in
 * jsPDF and the font as a Vite asset URL; this way the list can never drift out of date either.
 *
 * Add a generator here when you translate it.
 */
const GENERATORS = [
  join(__dirname, 'generalReportPdf.ts'),
  join(__dirname, 'retailReportPdf.ts'),
  join(__dirname, 'salesReportPdf.ts'),
  join(__dirname, '../../dashboards/investmentReportPdf.ts'),
]

/**
 * `t('a.b')`, `t('a.b', { count })`, this batch's `rowLabel(t, 'a.b')` / `rowLabel('a.b')`, and the
 * general report's `withColon('a.b')` / `bare('a.b')` — two thin wrappers over `t` that add or
 * strip the trailing colon, because it takes its labels from keys written for a screen where some
 * carry one ("Ukupno jedinica:") and some do not ("Budžet").
 */
const KEY_CALLS = [
  /\bt\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'/g,
  /\browLabel\(\s*(?:t,\s*)?'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'/g,
  /\b(?:withColon|bare)\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'/g,
]

const keysIn = (file: string): string[] => {
  const source = readFileSync(file, 'utf8')
  return [...new Set(KEY_CALLS.flatMap(pattern => [...source.matchAll(pattern)].map(m => m[1])))].sort()
}

const lookup = (bundle: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle)

/** i18next resolves `x_one` / `x_few` / `x_other` for a counted key; the plain path may not exist. */
const resolves = (bundle: Record<string, unknown>, key: string): boolean =>
  lookup(bundle, key) !== undefined || lookup(bundle, `${key}_other`) !== undefined

describe.each(GENERATORS.map(file => [file.split('/').pop() as string, file]))('%s', (_name, file) => {
  it('asks for at least a handful of keys, so the scan cannot silently match nothing', () => {
    expect(keysIn(file).length).toBeGreaterThan(10)
  })

  it('asks only for keys that exist in the Croatian bundle', () => {
    const missing = keysIn(file).filter(key => !resolves(hr as Record<string, unknown>, key))
    expect(missing, `Missing from hr/translation.json:\n${missing.join('\n')}`).toEqual([])
  })

  it('asks only for keys that exist in the English bundle', () => {
    // The exports are Croatian, but a key present in one bundle and not the other is a typo
    // waiting to surface on the screen that shares it.
    const missing = keysIn(file).filter(key => !resolves(en as Record<string, unknown>, key))
    expect(missing, `Missing from en/translation.json:\n${missing.join('\n')}`).toEqual([])
  })
})

describe('the keys the general report builds at run time', () => {
  // A literal scan cannot see `t(`reports.general.risks.${risk.kind}.type`)`, and the
  // recommendations are key paths the service mints — both are exactly the kind of thing that
  // would print a raw key path into an executive report and fail no test.
  const service = readFileSync(
    join(__dirname, '../services/generalReportService.ts'),
    'utf8',
  )

  it('has a heading and a sentence for every risk kind the service can emit', () => {
    const kinds = [...service.matchAll(/kind:\s*'([a-z_]+)'/g)].map(m => m[1])
    expect(kinds.length).toBeGreaterThan(0)

    for (const kind of kinds) {
      for (const bundle of [hr, en] as Record<string, unknown>[]) {
        expect(resolves(bundle, `reports.general.risks.${kind}.type`), `${kind}.type`).toBe(true)
        expect(resolves(bundle, `reports.general.risks.${kind}.description`), `${kind}.description`).toBe(true)
      }
    }
  })

  it('has a translation for every recommendation key the service pushes', () => {
    const keys = [...service.matchAll(/recommendationKeys\.push\('([a-z0-9_.]+)'\)/g)].map(m => m[1])
    expect(keys.length).toBeGreaterThan(0)

    for (const bundle of [hr, en] as Record<string, unknown>[]) {
      expect(keys.filter(key => !resolves(bundle, key))).toEqual([])
    }
  })

  it('has no doubled colon behind a label, which would defeat withColon and bare', () => {
    // The generators add or strip one trailing colon. A value that already ends in "::" — the
    // shape you get by pasting a screen label into a key that had one — beats both halves.
    const walk = (node: unknown, path: string): string[] => {
      if (typeof node === 'string') return /::\s*$/.test(node) ? [path] : []
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        return Object.entries(node as Record<string, unknown>)
          .flatMap(([key, value]) => walk(value, path ? `${path}.${key}` : key))
      }
      return []
    }
    expect(walk(hr, '')).toEqual([])
  })
})

describe('credit type labels', () => {
  it('has a label in both locales for every credit type the investment PDF can print', () => {
    // `investmentReportPdf` names an unnamed credit by its type. It used to print the raw enum
    // with the underscores swapped for spaces, which is where "LINE OF_CREDIT" came from.
    const types: [string, string | null][] = [
      ['term_loan', null], ['construction_loan', null], ['bridge_loan', null],
      ['line_of_credit', 'senior'], ['line_of_credit', 'junior'], ['equity', null],
    ]
    for (const [type, seniority] of types) {
      const key = getCreditTypeLabelKey(type, seniority)
      expect(key, `${type}/${seniority} has no label key`).toBeTruthy()
      expect(lookup(hr as Record<string, unknown>, key as string), `${key} missing from hr`).toBeTruthy()
      expect(lookup(en as Record<string, unknown>, key as string), `${key} missing from en`).toBeTruthy()
    }
  })
})
