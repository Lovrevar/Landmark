import { describe, it, expect } from 'vitest'
import { assertRowsAffected, isForeignKeyViolation, isUniqueViolation } from './dbErrors'
import { isPermissionError, toErrorMessage } from './errorMessage'

describe('assertRowsAffected', () => {
  it('passes when at least one row came back', () => {
    expect(() => assertRowsAffected([{ id: 'a' }])).not.toThrow()
  })

  it.each([[[]], [null], [undefined]])('turns %j into a permission error', rows => {
    let caught: unknown
    try {
      assertRowsAffected(rows as unknown[] | null | undefined)
    } catch (err) {
      caught = err
    }
    expect(isPermissionError(caught)).toBe(true)
    expect(isForeignKeyViolation(caught)).toBe(false)
    // The caller's translated fallback is what the user sees, never the marker.
    expect(toErrorMessage(caught, 'Nemate ovlast.')).toBe('Nemate ovlast.')
  })
})

describe('isUniqueViolation', () => {
  it('recognises the SQLSTATE and the message of a wrapped error', () => {
    expect(isUniqueViolation({ code: '23505', message: 'x' })).toBe(true)
    expect(isUniqueViolation(new Error('duplicate key value violates unique constraint "garages_unique_number_per_building"'))).toBe(true)
  })

  it('is false for other failures and for nothing at all', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false)
    expect(isUniqueViolation(new Error('permission denied'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})
