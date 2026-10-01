import { describe, it, expect } from 'vitest'
import { exportFileName, asciiSlug } from './downloadFile'

describe('asciiSlug', () => {
  it('folds Croatian letters to their ASCII base', () => {
    // A filename picked by a Croatian UI ends up on a shared drive, in an email and in a
    // Downloads folder; č and đ survive none of those reliably.
    expect(asciiSlug('Izvještaj')).toBe('izvjestaj')
    expect(asciiSlug('Stanje duga — Đakovo')).toBe('stanje-duga-dakovo')
    expect(asciiSlug('Savska Opatovina')).toBe('savska-opatovina')
    expect(asciiSlug('ČĆŽŠĐ')).toBe('cczsd')
  })

  it('collapses punctuation and trims the edges', () => {
    expect(asciiSlug('PANNONIA, d.o.o.')).toBe('pannonia-d-o-o')
    expect(asciiSlug('  --Retail--  ')).toBe('retail')
  })
})

describe('exportFileName', () => {
  it('stamps an ISO date so a folder sorts chronologically', () => {
    expect(exportFileName('izvjestaj-portfelj', 'pdf', new Date(2026, 0, 5))).toBe(
      'izvjestaj-portfelj-2026-01-05.pdf',
    )
  })

  it('takes the local date, not UTC', () => {
    // toISOString() would stamp the previous day between midnight and 02:00 Croatian summer time.
    expect(exportFileName('stanje-duga', 'xlsx', new Date(2026, 5, 1, 0, 30))).toBe(
      'stanje-duga-2026-06-01.xlsx',
    )
  })

  it('slugs the prefix it is given', () => {
    expect(exportFileName('Stanje duga — Đakovo', 'xlsx', new Date(2026, 8, 23))).toBe(
      'stanje-duga-dakovo-2026-09-23.xlsx',
    )
  })
})
