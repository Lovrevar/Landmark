import { describe, it, expect } from 'vitest'
import { formatPhaseLabel } from './phaseLabel'

describe('formatPhaseLabel', () => {
  it('shows only the number when the name is just the same thing again', () => {
    // The migration names folded phases "Faza 1", which naive concatenation rendered as
    // "Faza 1 · Faza 1".
    expect(formatPhaseLabel({ phase_number: 1, phase_name: 'Faza 1' }, 'Faza')).toBe('Faza 1')
    expect(formatPhaseLabel({ phase_number: 2, phase_name: 'Faza 2' }, 'Faza')).toBe('Faza 2')
  })

  it('collapses regardless of the UI language', () => {
    // Names are stored as literal Croatian; the UI may be English. Comparing the name against
    // the translated word only worked when the two languages happened to agree.
    expect(formatPhaseLabel({ phase_number: 1, phase_name: 'Faza 1' }, 'Phase')).toBe('Phase 1')
    expect(formatPhaseLabel({ phase_number: 1, phase_name: 'Phase 1' }, 'Faza')).toBe('Faza 1')
    expect(formatPhaseLabel({ phase_number: 3, phase_name: 'Etapa 3' }, 'Phase')).toBe('Phase 3')
  })

  it('appends a real phase name', () => {
    expect(formatPhaseLabel({ phase_number: 1, phase_name: 'Foundation Phase' }, 'Faza'))
      .toBe('Faza 1 · Foundation Phase')
    expect(formatPhaseLabel({ phase_number: 1, phase_name: 'Retroaktivno' }, 'Faza'))
      .toBe('Faza 1 · Retroaktivno')
    expect(formatPhaseLabel({ phase_number: 2, phase_name: 'Izgradnja zgrade A' }, 'Faza'))
      .toBe('Faza 2 · Izgradnja zgrade A')
  })

  it('tolerates casing, padding and stray whitespace', () => {
    expect(formatPhaseLabel({ phase_number: 3, phase_name: '  faza 3 ' }, 'Faza')).toBe('Faza 3')
    expect(formatPhaseLabel({ phase_number: 3, phase_name: 'Faza 03' }, 'Faza')).toBe('Faza 3')
    expect(formatPhaseLabel({ phase_number: 3, phase_name: '3' }, 'Faza')).toBe('Faza 3')
  })

  it('falls back to the number for an empty name', () => {
    expect(formatPhaseLabel({ phase_number: 4, phase_name: '' }, 'Faza')).toBe('Faza 4')
    expect(formatPhaseLabel({ phase_number: 4, phase_name: '   ' }, 'Faza')).toBe('Faza 4')
  })

  it('keeps a name whose number disagrees with the phase number', () => {
    // "Faza 2" sitting on phase 1 is a data oddity worth showing, not hiding.
    expect(formatPhaseLabel({ phase_number: 1, phase_name: 'Faza 2' }, 'Faza')).toBe('Faza 1 · Faza 2')
  })

  it('keeps a multi-word name that merely ends in the number', () => {
    expect(formatPhaseLabel({ phase_number: 1, phase_name: 'Izgradnja zgrade 1' }, 'Faza'))
      .toBe('Faza 1 · Izgradnja zgrade 1')
  })
})
