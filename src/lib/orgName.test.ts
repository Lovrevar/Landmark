import { describe, it, expect } from 'vitest'
import { normalizeOrgName, orgHeading } from './orgName'

describe('normalizeOrgName', () => {
  it('trims the stored name', () => {
    expect(normalizeOrgName('  Landmark Group ')).toBe('Landmark Group')
  })

  it('treats a missing or blank value as no name', () => {
    expect(normalizeOrgName(undefined)).toBeNull()
    expect(normalizeOrgName(null)).toBeNull()
    expect(normalizeOrgName('   ')).toBeNull()
  })
})

describe('orgHeading', () => {
  it('capitalises the name with Croatian rules', () => {
    expect(orgHeading('Građevina Đakovo')).toBe('GRAĐEVINA ĐAKOVO')
  })

  it('is null when no name is configured', () => {
    expect(orgHeading(null)).toBeNull()
    expect(orgHeading(undefined)).toBeNull()
  })
})
