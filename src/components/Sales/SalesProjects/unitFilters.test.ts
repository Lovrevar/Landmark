import { describe, it, expect } from 'vitest'
import { filterUnitsByStatus, getSelectableUnitIds, getUnitsOfType } from './unitFilters'
import type { BuildingWithUnits } from './types'

const units = [
  { id: 'a1', status: 'Available' },
  { id: 'r1', status: 'Reserved' },
  { id: 's1', status: 'Sold' },
  { id: 'a2', status: 'Available' }
]

describe('filterUnitsByStatus', () => {
  it('returns every unit for "all"', () => {
    expect(filterUnitsByStatus(units, 'all')).toEqual(units)
  })

  it('keeps only units with the matching status', () => {
    expect(filterUnitsByStatus(units, 'available').map(u => u.id)).toEqual(['a1', 'a2'])
    expect(filterUnitsByStatus(units, 'reserved').map(u => u.id)).toEqual(['r1'])
    expect(filterUnitsByStatus(units, 'sold').map(u => u.id)).toEqual(['s1'])
  })

  it('preserves the extra fields of the unit type', () => {
    const priced = [{ id: 'x', status: 'Available', price: 100 }]
    expect(filterUnitsByStatus(priced, 'available')[0].price).toBe(100)
  })
})

describe('getSelectableUnitIds', () => {
  it('excludes Sold units under "all"', () => {
    expect(getSelectableUnitIds(units, 'all')).toEqual(['a1', 'r1', 'a2'])
  })

  it('respects the status filter', () => {
    expect(getSelectableUnitIds(units, 'reserved')).toEqual(['r1'])
  })

  it('selects nothing under the "sold" filter', () => {
    expect(getSelectableUnitIds(units, 'sold')).toEqual([])
  })

  it('returns an empty list for no units', () => {
    expect(getSelectableUnitIds([], 'all')).toEqual([])
  })
})

describe('getUnitsOfType', () => {
  const building = {
    apartments: [{ id: 'apt' }],
    garages: [{ id: 'gar' }],
    repositories: [{ id: 'rep' }]
  } as unknown as BuildingWithUnits

  it('picks the list for the unit type', () => {
    expect(getUnitsOfType(building, 'apartment').map(u => u.id)).toEqual(['apt'])
    expect(getUnitsOfType(building, 'garage').map(u => u.id)).toEqual(['gar'])
    expect(getUnitsOfType(building, 'repository').map(u => u.id)).toEqual(['rep'])
  })
})
