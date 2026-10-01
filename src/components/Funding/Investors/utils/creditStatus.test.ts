import { describe, it, expect } from 'vitest'
import { getCreditStatusDisplay, getCreditStatusVariant, CREDIT_STATUS_DISPLAY } from './creditStatus'

describe('getCreditStatusDisplay', () => {
  it('covers exactly the three values the CHECK constraint allows', () => {
    expect(Object.keys(CREDIT_STATUS_DISPLAY).sort()).toEqual(['active', 'defaulted', 'paid'])
  })

  it('gives a defaulted credit a red badge, not the calm blue fallback it used to get', () => {
    expect(getCreditStatusDisplay('defaulted')).toEqual({
      labelKey: 'funding.credit_status.defaulted',
      variant: 'red',
    })
  })

  it('is green while active and gray once repaid', () => {
    expect(getCreditStatusVariant('active')).toBe('green')
    expect(getCreditStatusVariant('paid')).toBe('gray')
  })

  it('returns null for the statuses the old screens branched on but the database never stores', () => {
    expect(getCreditStatusDisplay('pending')).toBeNull()
    expect(getCreditStatusDisplay('closed')).toBeNull()
  })

  it('returns null for a missing status and falls back to a neutral variant', () => {
    expect(getCreditStatusDisplay(null)).toBeNull()
    expect(getCreditStatusDisplay(undefined)).toBeNull()
    expect(getCreditStatusDisplay('')).toBeNull()
    expect(getCreditStatusVariant('something else')).toBe('gray')
  })

  it('is case-sensitive: the stored values are lowercase', () => {
    expect(getCreditStatusDisplay('ACTIVE')).toBeNull()
  })
})
