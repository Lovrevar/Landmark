import { describe, it, expect } from 'vitest'
import { assertRowsAffected, isForeignKeyViolation } from './dbErrors'
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
