import { describe, it, expect } from 'vitest'
import {
  defaultClassificationForLine,
  applyDefaultClassifications,
  CANONICAL_TIC_LINE_NAMES
} from './ticClassificationMap'
import { defaultLineItems } from '../constants'

const CLASSIFICATIONS = [
  { id: 1, code: 'zemljiste' },
  { id: 2, code: 'priprema_i_razvoj' },
  { id: 3, code: 'izgradnja_i_uredenje' },
  { id: 4, code: 'opremanje' },
  { id: 5, code: 'kontrola' },
  { id: 6, code: 'financiranje_i_nadzor' },
  { id: 7, code: 'nepredvideni_troskovi' },
  { id: 8, code: null }, // a user-created classification has no code
]

describe('defaultClassificationForLine', () => {
  it('maps every one of the 16 canonical INVESTICIJA rows', () => {
    // defaultLineItems is what a fresh TIC starts from and what production stores; if a row is
    // added there without a mapping here, its money silently leaves the per-classification
    // totals. Driving the assertion off the constant rather than a copy is what catches that.
    for (const item of defaultLineItems) {
      expect(
        defaultClassificationForLine(item.name),
        `"${item.name}" has no default classification`
      ).not.toBeNull()
    }
    expect(defaultLineItems).toHaveLength(16)
    expect(CANONICAL_TIC_LINE_NAMES).toHaveLength(16)
  })

  it('groups land acquisition together', () => {
    expect(defaultClassificationForLine('Vrijednost zemljišta')).toBe('zemljiste')
    expect(defaultClassificationForLine('Porez na promet nekretnina')).toBe('zemljiste')
  })

  it('groups pre-construction spend under preparation', () => {
    expect(defaultClassificationForLine('Priprema projekta')).toBe('priprema_i_razvoj')
    expect(defaultClassificationForLine('Projektna dokumentacija, geodetske usluge')).toBe('priprema_i_razvoj')
    expect(defaultClassificationForLine('Komunalni i vodni doprinos')).toBe('priprema_i_razvoj')
    expect(defaultClassificationForLine('Priključci')).toBe('priprema_i_razvoj')
  })

  it('groups the build itself under construction', () => {
    expect(defaultClassificationForLine('Građenje')).toBe('izgradnja_i_uredenje')
    expect(defaultClassificationForLine('Unutarnje uređenje')).toBe('izgradnja_i_uredenje')
  })

  it('groups oversight and close-out paperwork under control', () => {
    expect(defaultClassificationForLine('Stručni nadzor')).toBe('kontrola')
    expect(defaultClassificationForLine('Konzalting')).toBe('kontrola')
    expect(defaultClassificationForLine('Uknjižba, etažiranje, uporabna dozvola')).toBe('kontrola')
  })

  it('groups cost of money and selling under financing', () => {
    expect(defaultClassificationForLine('Financiranje')).toBe('financiranje_i_nadzor')
    expect(defaultClassificationForLine('Financijski nadzor')).toBe('financiranje_i_nadzor')
    expect(defaultClassificationForLine('Posredovanje, marketing, osiguranje')).toBe('financiranje_i_nadzor')
  })

  it('maps the remaining two one-to-one', () => {
    expect(defaultClassificationForLine('Opremanje (namještaj, bijela tehnika)')).toBe('opremanje')
    expect(defaultClassificationForLine('Nepredviđeni troškovi')).toBe('nepredvideni_troskovi')
  })

  it('tolerates casing and stray whitespace on a hand-edited label', () => {
    expect(defaultClassificationForLine('  GRAĐENJE ')).toBe('izgradnja_i_uredenje')
    expect(defaultClassificationForLine('vrijednost zemljišta')).toBe('zemljiste')
  })

  it('returns null for a row the user added themselves', () => {
    // Left for the user to classify in the TIC table. Its money is excluded from the totals and
    // shown as unmapped rather than guessed into a bucket.
    expect(defaultClassificationForLine('Rušenje postojećeg objekta')).toBeNull()
    expect(defaultClassificationForLine('')).toBeNull()
  })

  it('does not fuzzy-match a similar but different label', () => {
    // "Nadzor" alone is ambiguous between stručni and financijski nadzor, which land in
    // different classifications — guessing would file money under the wrong heading.
    expect(defaultClassificationForLine('Nadzor')).toBeNull()
    expect(defaultClassificationForLine('Zemljište')).toBeNull()
  })
})

describe('applyDefaultClassifications', () => {
  const line = (name: string, classification_id?: number | null) =>
    ({ name, vlastita: 0, kreditna: 0, ...(classification_id !== undefined ? { classification_id } : {}) })

  it('classifies freshly imported rows, which arrive with no mapping at all', () => {
    // This is the case that matters: without it, every Excel import empties the mapping and
    // takes the per-classification totals (and any phase budget filled from them) with it.
    const imported = [line('Građenje'), line('Vrijednost zemljišta')]
    const result = applyDefaultClassifications(imported, CLASSIFICATIONS)
    expect(result[0].classification_id).toBe(3)
    expect(result[1].classification_id).toBe(1)
  })

  it('never overwrites a classification someone already chose', () => {
    // A project may deliberately file Građenje somewhere other than the default.
    const result = applyDefaultClassifications([line('Građenje', 5)], CLASSIFICATIONS)
    expect(result[0].classification_id).toBe(5)
  })

  it('treats an explicit null as a decision, not a gap', () => {
    // Leaving a row unclassified on purpose must survive a re-import.
    const result = applyDefaultClassifications([line('Građenje', null)], CLASSIFICATIONS)
    expect(result[0].classification_id).toBeNull()
  })

  it('leaves a user-added row unclassified rather than guessing', () => {
    const result = applyDefaultClassifications([line('Rušenje objekta')], CLASSIFICATIONS)
    expect(result[0].classification_id).toBeNull()
  })

  it('yields null when the seeded classification is missing from the database', () => {
    const result = applyDefaultClassifications([line('Građenje')], [{ id: 1, code: 'zemljiste' }])
    expect(result[0].classification_id).toBeNull()
  })

  it('maps the whole default template, so a new TIC starts fully classified', () => {
    const result = applyDefaultClassifications(defaultLineItems, CLASSIFICATIONS)
    expect(result.every(r => typeof r.classification_id === 'number')).toBe(true)
  })

  it('does not mutate the input', () => {
    const input = [line('Građenje')]
    applyDefaultClassifications(input, CLASSIFICATIONS)
    expect(input[0]).not.toHaveProperty('classification_id')
  })
})
