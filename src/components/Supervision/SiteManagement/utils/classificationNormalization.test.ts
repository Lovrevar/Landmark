import { describe, it, expect } from 'vitest'
import { normalizeLegacyPhaseName } from './classificationNormalization'

describe('normalizeLegacyPhaseName', () => {
  // Every distinct phase_name observed in production before the fold.
  const PRODUCTION_NAMES: Array<[string, string | null]> = [
    ['Priprema i razvoj', 'priprema_i_razvoj'],
    ['Priprema i Razvoj', 'priprema_i_razvoj'],       // casing drift
    ['Zemljište', 'zemljiste'],
    ['Kupoprodaja Zemljišta', 'zemljiste'],           // synonym
    ['Izgradnja i uređenje', 'izgradnja_i_uredenje'],
    [' Izgradnja i uređenje', 'izgradnja_i_uredenje'], // leading space
    ['Izgradnja', 'izgradnja_i_uredenje'],            // synonym
    ['Izgradnja ', 'izgradnja_i_uredenje'],           // trailing space
    ['Opremanje', 'opremanje'],
    ['Kontrola', 'kontrola'],
    [' Kontrola', 'kontrola'],                        // leading space
    ['Financiranje i nadzor', 'financiranje_i_nadzor'],
    ['Nadzor i Financiranje', 'financiranje_i_nadzor'], // word order drift
    ['Nepredviđeni troškovi', 'nepredvideni_troskovi'],
    ['Nepredviđeni Troškovi', 'nepredvideni_troskovi'], // casing drift
    // The two that are real phase names and must survive the fold untouched.
    ['Foundation Phase', null],
    ['Retroaktivno', null]
  ]

  it.each(PRODUCTION_NAMES)('maps %j to %j', (input, expected) => {
    expect(normalizeLegacyPhaseName(input)).toBe(expected)
  })

  it('covers all 17 production spellings, 15 of which map to a classification', () => {
    const mapped = PRODUCTION_NAMES.filter(([, code]) => code !== null)
    expect(PRODUCTION_NAMES).toHaveLength(17)
    expect(mapped).toHaveLength(15)
    expect(new Set(mapped.map(([, code]) => code)).size).toBe(7)
  })

  it('leaves an unrecognised name alone rather than guessing', () => {
    expect(normalizeLegacyPhaseName('Etapa A - iskop')).toBeNull()
    expect(normalizeLegacyPhaseName('')).toBeNull()
  })

  it('is accent-sensitive, so a de-accented spelling is not silently accepted', () => {
    // "Zemljiste" without the š is NOT the same string users typed; treating it as a match
    // would be a guess, and the migration prefers to leave such a row as a real phase name.
    expect(normalizeLegacyPhaseName('Zemljiste')).toBeNull()
  })
})
