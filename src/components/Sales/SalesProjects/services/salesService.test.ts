import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))
vi.mock('../../../../lib/activityLog', () => ({ logActivity: vi.fn() }))

import { cancelSale, CancelSaleError, nextBuildingNames } from './salesService'
import { logActivity } from '../../../../lib/activityLog'

beforeEach(() => {
  rpc.mockReset()
  vi.mocked(logActivity).mockClear()
})

const cancelled = {
  sale_id: 's1', customer_id: 'c1', sale_price: 215000, sale_date: '2026-03-01',
  buyer_name: 'Ana Horvat', customer_status_reverted: true,
}

describe('cancelSale', () => {
  it('calls the one database function with the apartment', async () => {
    rpc.mockResolvedValue({ data: cancelled, error: null })
    await cancelSale({ id: 'a1', number: 'A-101' }, 'p1')
    expect(rpc).toHaveBeenCalledWith('cancel_apartment_sale', { p_apartment_id: 'a1' })
  })

  // The sales row is deleted, so the log entry is the only record that the sale ever existed.
  it('records who the buyer was and at what price, as a high-severity action', async () => {
    rpc.mockResolvedValue({ data: cancelled, error: null })
    await cancelSale({ id: 'a1', number: 'A-101' }, 'p1')
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'sale.cancel', entity: 'sale', entityId: 's1', projectId: 'p1', severity: 'high',
      metadata: expect.objectContaining({ entity_name: 'Ana Horvat', sale_price: 215000, unit_id: 'a1', unit_number: 'A-101' }),
    }))
    const actions = vi.mocked(logActivity).mock.calls.map(call => call[0].action)
    expect(actions).toEqual(['sale.cancel', 'apartment.update', 'customer.update'])
  })

  it('does not log a customer change when the customer still has another sale', async () => {
    rpc.mockResolvedValue({ data: { ...cancelled, customer_status_reverted: false }, error: null })
    await cancelSale({ id: 'a1' })
    expect(vi.mocked(logActivity).mock.calls.map(call => call[0].action)).toEqual(['sale.cancel', 'apartment.update'])
  })

  it.each([
    ['P0001', 'has_invoices'],
    ['42501', 'not_allowed'],
    ['P0002', 'no_sale'],
  ])('turns SQLSTATE %s into the refusal "%s" and logs nothing', async (code, reason) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'refused' } })
    await expect(cancelSale({ id: 'a1' })).rejects.toMatchObject({ reason })
    await expect(cancelSale({ id: 'a1' })).rejects.toBeInstanceOf(CancelSaleError)
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('passes any other failure through unchanged', async () => {
    const failure = { code: '08006', message: 'connection failure' }
    rpc.mockResolvedValue({ data: null, error: failure })
    await expect(cancelSale({ id: 'a1' })).rejects.toBe(failure)
    expect(logActivity).not.toHaveBeenCalled()
  })
})

describe('nextBuildingNames', () => {
  const zgrada = (i: number) => `Zgrada ${i}`

  it('starts at 1 in an empty project', () => {
    expect(nextBuildingNames([], 3, zgrada)).toEqual(['Zgrada 1', 'Zgrada 2', 'Zgrada 3'])
  })

  // Bulk create always started at 1, so a second run made a second "Zgrada 1…n" (SALES-17).
  it('continues after the names a project already has', () => {
    expect(nextBuildingNames(['Zgrada 1', 'Zgrada 2'], 2, zgrada)).toEqual(['Zgrada 3', 'Zgrada 4'])
  })

  it('fills gaps and compares the way the unique index does', () => {
    expect(nextBuildingNames([' zgrada 2 ', 'Toranj A'], 3, zgrada)).toEqual(['Zgrada 1', 'Zgrada 3', 'Zgrada 4'])
  })
})
