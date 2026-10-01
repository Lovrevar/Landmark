import { describe, it, expect } from 'vitest'
import { findRemovedPhases } from './phaseSetup'
import { PhaseFormInput } from '../types'

const saved = [
  { id: 'a', phase_name: 'Faza 1' },
  { id: 'b', phase_name: 'Faza 2' },
  { id: 'c', phase_name: 'Faza 3' }
]

const row = (id?: string, name = ''): PhaseFormInput => ({ id, phase_name: name, start_date: '', end_date: '' })

describe('findRemovedPhases', () => {
  it('returns nothing when every saved phase is still in the form', () => {
    expect(findRemovedPhases(saved, [row('a'), row('b'), row('c')])).toEqual([])
  })

  it('ignores newly added rows without an id', () => {
    expect(findRemovedPhases(saved, [row('a'), row('b'), row('c'), row(undefined, 'Faza 4')])).toEqual([])
  })

  it('reports the phases sliced off when the count is lowered', () => {
    expect(findRemovedPhases(saved, [row('a')])).toEqual([saved[1], saved[2]])
  })

  it('still reports a phase that was sliced off and then re-added as a new row', () => {
    expect(findRemovedPhases(saved, [row('a'), row('b'), row(undefined, 'Faza 3')])).toEqual([saved[2]])
  })

  it('returns nothing when there were no saved phases', () => {
    expect(findRemovedPhases([], [row(undefined, 'Faza 1')])).toEqual([])
  })
})
