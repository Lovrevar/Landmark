import { describe, it, expect, vi, beforeEach } from 'vitest'

import { emptyFakeDb, type FakeDb } from '../../../../test/fakeSupabase'

const rpc = vi.fn()
// RPCs are mocked per test; table reads go to the shared fake client.
const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('../../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../../test/fakeSupabase')
  return { supabase: { ...fakeSupabase(db), rpc: (...args: unknown[]) => rpc(...args) } }
})
vi.mock('../../../../lib/activityLog', () => ({ logActivity: vi.fn() }))

import {
  cancelSale, CancelSaleError, fetchActualTotalPaidByApartment, fetchApartments, fetchCustomers, fetchGarages,
  fetchRepositories, fetchSales, nextBuildingNames,
} from './salesService'
import { logActivity } from '../../../../lib/activityLog'

beforeEach(() => {
  rpc.mockReset()
  vi.mocked(logActivity).mockClear()
  Object.assign(db, emptyFakeDb())
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

describe('the Sales projects screen reads past one PostgREST page', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i).padStart(4, '0'))

  // GEN-43: each list stopped at row 1000 without a word.
  it('GEN-43: apartments, garages, storage, customers and sales come back whole', async () => {
    db.tables = {
      apartments: ids(1_001).map(id => ({ id: `a${id}`, number: id, apartment_garages: [], apartment_repositories: [] })),
      garages: ids(1_001).map(id => ({ id: `g${id}`, number: id })),
      repositories: ids(1_001).map(id => ({ id: `r${id}`, number: id })),
      customers: ids(1_001).map(id => ({ id: `c${id}`, name: `Kupac ${id}` })),
      sales: ids(1_001).map(id => ({ id: `s${id}`, apartment_id: `a${id}`, customers: null })),
    }
    expect(await fetchApartments()).toHaveLength(1_001)
    expect(await fetchGarages()).toHaveLength(1_001)
    expect(await fetchRepositories()).toHaveLength(1_001)
    expect(await fetchCustomers()).toHaveLength(1_001)
    expect(await fetchSales()).toHaveLength(1_001)
  })

  // GEN-43: what buyers paid on each Sold apartment ("Naplaćeno"). It read the invoices with every
  // apartment id in the URL, then the payments with every invoice id, and stopped at 1000 rows.
  it('GEN-43: sums every sales payment of the apartments asked for, and nothing else', async () => {
    const sales = (apartmentId: string | null) => ({ invoice_type: 'OUTGOING_SALES', apartment_id: apartmentId })
    db.tables.accounting_invoices = [
      { id: 'i1', ...sales('a1') }, { id: 'i2', ...sales('a2') }, { id: 'i3', ...sales('a3') },
      { id: 'i4', invoice_type: 'INCOMING_SUPPLIER', apartment_id: 'a1' }, { id: 'i5', ...sales(null) },
    ]
    db.tables.accounting_payments = [
      ...ids(1_001).map(id => ({ id: `p${id}`, invoice_id: 'i1', amount: '10', invoice: sales('a1') })),
      { id: 'q1', invoice_id: 'i2', amount: '500.50', invoice: sales('a2') },
      // Not asked for, not a sales invoice, no apartment: none of them counts.
      { id: 'q2', invoice_id: 'i3', amount: '999', invoice: sales('a3') },
      { id: 'q3', invoice_id: 'i4', amount: '999', invoice: { invoice_type: 'INCOMING_SUPPLIER', apartment_id: 'a1' } },
      { id: 'q4', invoice_id: 'i5', amount: '999', invoice: sales(null) },
    ]
    const paid = await fetchActualTotalPaidByApartment(['a1', 'a2'])
    expect(Object.fromEntries(paid)).toEqual({ a1: 10_010, a2: 500.5 })
  })

  it('reads nothing when no apartment is asked for', async () => {
    db.failing = { accounting_payments: 'should not be read' }
    expect(await fetchActualTotalPaidByApartment([])).toEqual(new Map())
  })

  it.each(['apartments', 'sales', 'customers'])('rejects when the %s read fails', async table => {
    db.failing = { [table]: `permission denied for table ${table}` }
    const read = { apartments: fetchApartments, sales: fetchSales, customers: fetchCustomers }[table]!
    await expect(read()).rejects.toMatchObject({ message: `permission denied for table ${table}` })
  })
})
