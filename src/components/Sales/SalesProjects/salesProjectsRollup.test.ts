import { describe, expect, it } from 'vitest'
import type { Apartment, Building, Garage, Project, Repository } from '../../../lib/supabase'
import { buildSalesProjects, type SaleWithCustomer } from './salesProjectsRollup'

/**
 * Characterization tests: they record what the Sales projects screen shows today, before its
 * revenue and sold counts move into shared functions (docs/REGRESSION_PREVENTION.md, Step 7
 * item 2). Where a pinned figure is known to be wrong, the comment names the backlog id.
 *
 * Do not edit an expectation to get a refactor green. If one moves, the refactor changed a figure.
 */

const linked = (id: string, price: number) => ({ id, number: id.toUpperCase(), size_m2: 15, price, status: 'Sold' })

const apartment = (id: string, building_id: string, status: Apartment['status'], extra: Partial<Apartment> = {}) =>
  ({ id, project_id: 'p?', building_id, number: id.toUpperCase(), status, price: 100_000, buyer_name: null, ...extra }) as Apartment
const garage = (id: string, building_id: string, status: Garage['status']) =>
  ({ id, building_id, number: id.toUpperCase(), status, price: 15_000, buyer_name: null }) as Garage
const repository = (id: string, building_id: string, status: Repository['status']) =>
  ({ id, building_id, number: id.toUpperCase(), status, price: 5_000, buyer_name: null }) as Repository
const sale = (apartment_id: string, extra: Partial<SaleWithCustomer> = {}): SaleWithCustomer => ({
  apartment_id,
  sale_price: 198_000,
  payment_method: 'bank_loan',
  down_payment: 20_000,
  // A sale-time snapshot that nothing should read (SALES-6).
  total_paid: 10_000,
  remaining_amount: 188_000,
  monthly_payment: 0,
  sale_date: '2026-10-03',
  contract_signed: true,
  customers: null,
  ...extra,
})

const input = () => ({
  projects: [{ id: 'p1', name: 'Zelena Dolina' }, { id: 'p2', name: 'Precko Zapad' }] as Project[],
  buildings: [
    { id: 'bd1', project_id: 'p1', name: 'A' },
    { id: 'bd2', project_id: 'p1', name: 'B' },
    { id: 'bd3', project_id: 'p2', name: 'C' },
  ] as Building[],
  apartments: [
    apartment('a1', 'bd1', 'Sold', { linked_garages: [linked('g1', 15_000)], linked_repositories: [linked('r1', 5_000)] }),
    apartment('a2', 'bd1', 'Sold', { buyer_name: 'Ivan Kovač' }),
    apartment('a3', 'bd1', 'Reserved'),
    apartment('a4', 'bd2', 'Available', { linked_garages: [linked('g3', 15_000)] }),
    apartment('a7', 'bd2', 'Sold', { buyer_name: 'Stari Kupac' }), // no sale row (SALES-22)
    apartment('a5', 'bd3', 'Sold'),
  ],
  garages: [garage('g1', 'bd1', 'Sold'), garage('g2', 'bd1', 'Sold'), garage('g3', 'bd2', 'Available'), garage('g4', 'bd3', 'Available')],
  repositories: [repository('r1', 'bd1', 'Sold'), repository('r2', 'bd3', 'Available')],
  sales: [
    sale('a1', { customers: { name: 'Ana', surname: 'Horvat', email: 'ana@example.hr', phone: '091' } }),
    sale('a2', { sale_price: 150_000.5 }),
    sale('a5', { sale_price: 295_000 }),
  ],
  paidByApartment: new Map([['a1', 45_000], ['a2', 50_000], ['a7', 99]]),
})

describe('buildSalesProjects', () => {
  it('per building: units, sold counts, and revenue as what was collected on Sold apartments', () => {
    const { buildings } = buildSalesProjects(input())
    expect(buildings.map(b => ({
      id: b.id,
      units: [b.total_apartments, b.total_garages, b.total_repositories],
      sold: [b.sold_apartments, b.sold_garages, b.sold_repositories],
      revenue: b.total_revenue,
    }))).toEqual([
      // Collected on a1 and a2. The sold garages and storage add nothing: they never get a sale (SALES-23).
      { id: 'bd1', units: [3, 2, 1], sold: [2, 2, 1], revenue: 95_000 },
      // a7 is Sold with no sale row, so nothing collected on it counts.
      { id: 'bd2', units: [2, 1, 0], sold: [1, 0, 0], revenue: 0 },
      { id: 'bd3', units: [1, 1, 1], sold: [1, 0, 0], revenue: 0 },
    ])
  })

  it('per project: the sum of its buildings, every unit type counted', () => {
    const { projects } = buildSalesProjects(input())
    expect(projects.map(p => [p.id, p.total_buildings, p.total_units, p.sold_units, p.total_revenue])).toEqual([
      ['p1', 2, 9, 6, 95_000],
      ['p2', 1, 3, 1, 0],
    ])
  })

  it('a Sold apartment with a sale carries it; paid is what was collected, not the snapshot', () => {
    const { apartments } = buildSalesProjects(input())
    const info = Object.fromEntries(apartments.map(a => [a.id, a.sale_info]))
    expect(info.a1).toEqual({
      sale_price: 198_000, payment_method: 'bank_loan', down_payment: 20_000, total_paid: 45_000,
      remaining_amount: 188_000, monthly_payment: 0, sale_date: '2026-10-03', contract_signed: true,
      buyer_name: 'Ana Horvat', buyer_email: 'ana@example.hr', buyer_phone: '091',
    })
    expect(info.a2).toMatchObject({ sale_price: 150_000.5, total_paid: 50_000, buyer_name: 'Ivan Kovač', buyer_email: '' })
    expect(info.a5).toMatchObject({ total_paid: 0, buyer_name: 'Unknown' })
    expect([info.a3, info.a4, info.a7]).toEqual([undefined, undefined, undefined])
  })

  it('a linked Available garage or storage unit shows as Reserved; a sold one never gets its sale (SALES-23)', () => {
    const { garages, repositories } = buildSalesProjects(input())
    expect(garages.map(g => [g.id, g.status, g.sale_info])).toEqual([
      ['g1', 'Sold', undefined],
      ['g2', 'Sold', undefined],
      ['g3', 'Reserved', undefined],
      ['g4', 'Available', undefined],
    ])
    expect(repositories.map(r => [r.id, r.status, r.sale_info])).toEqual([
      ['r1', 'Sold', undefined],
      ['r2', 'Available', undefined],
    ])
  })

  it('nothing to show', () => {
    expect(buildSalesProjects({ projects: [], buildings: [], apartments: [], garages: [], repositories: [], sales: [], paidByApartment: new Map() }))
      .toEqual({ projects: [], buildings: [], apartments: [], garages: [], repositories: [] })
  })
})
