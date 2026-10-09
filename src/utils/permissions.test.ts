import { describe, it, expect } from 'vitest'
import {
  canEditSalesUnits, canDeleteSalesUnits, canManageSubcontractors, canDeleteSubcontractors, canManageWorkLogs,
} from './permissions'
import type { User } from '../contexts/AuthContext'

const ROLES = ['Director', 'Accounting', 'Sales', 'Supervision', 'Investment'] as const
const as = (role: string) => ({ id: 'u', role } as unknown as User)
const allowed = (check: (user: User | null) => boolean) => ROLES.filter(role => check(as(role)))

/**
 * Each helper mirrors an RLS policy (read from production on 2026-10-08). A button shown to a
 * role the policy refuses fails with an error or, for an update or delete, with nothing at all.
 */
describe('button permissions follow the RLS policies', () => {
  it('sales inventory: Director, Sales and Accounting write; Accounting cannot delete', () => {
    expect(allowed(canEditSalesUnits)).toEqual(['Director', 'Accounting', 'Sales'])
    expect(allowed(canDeleteSalesUnits)).toEqual(['Director', 'Sales'])
  })

  it('subcontractors: Director, Accounting and Supervision write; only a Director deletes', () => {
    expect(allowed(canManageSubcontractors)).toEqual(['Director', 'Accounting', 'Supervision'])
    expect(allowed(canDeleteSubcontractors)).toEqual(['Director'])
  })

  it('work logs: Director and Supervision', () => {
    expect(allowed(canManageWorkLogs)).toEqual(['Director', 'Supervision'])
  })

  it('nobody signed in may do anything', () => {
    for (const check of [canEditSalesUnits, canDeleteSalesUnits, canManageSubcontractors, canDeleteSubcontractors, canManageWorkLogs]) {
      expect(check(null)).toBe(false)
    }
  })
})
