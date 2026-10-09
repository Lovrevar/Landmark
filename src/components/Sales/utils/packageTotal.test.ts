import { describe, it, expect } from 'vitest'
import { packageTotal, unitPackageTotal } from './packageTotal'

describe('packageTotal', () => {
  it('is list prices throughout before a sale', () => {
    expect(packageTotal({ listPrice: 200_000, linkedPrices: [15_000, 5_000] })).toBe(220_000)
    expect(packageTotal({ listPrice: 200_000, salePrice: null, linkedPrices: [] })).toBe(200_000)
  })

  // The three sales in production on 2026-10-08 all carry the apartment's list price as their
  // sale price, with a garage and a storage unit linked: the total has to include those.
  it('is the sale price plus the linked units once sold', () => {
    expect(packageTotal({ listPrice: 200_000, salePrice: 200_000, linkedPrices: [15_000, 5_000] })).toBe(220_000)
  })

  it('follows a negotiated sale price, not the list price', () => {
    expect(packageTotal({ listPrice: 200_000, salePrice: 190_000, linkedPrices: [15_000] })).toBe(205_000)
    expect(packageTotal({ listPrice: 200_000, salePrice: 210_500.5 })).toBe(210_500.5)
  })

  it('treats a missing or zero sale price as not sold, and missing prices as nothing', () => {
    expect(packageTotal({ listPrice: 200_000, salePrice: 0, linkedPrices: [undefined, null, 5_000] })).toBe(205_000)
    expect(packageTotal({ listPrice: null })).toBe(0)
  })
})

describe('unitPackageTotal', () => {
  it('adds the garage and storage unit a purchased unit carries to its sale price', () => {
    expect(unitPackageTotal({ price: 200_000, sale_price: 195_000, garages: [{ price: 15_000 }], repositories: [{ price: 5_000 }] })).toBe(215_000)
    expect(unitPackageTotal({ price: 12_000, sale_price: 12_000, garages: [], repositories: [] })).toBe(12_000)
  })

  // The Customers screens kept one garage and one storage unit per apartment, so a second of
  // either was missing from the total (SALES-8).
  it('counts every linked unit, not one of each', () => {
    expect(unitPackageTotal({
      price: 200_000, sale_price: 200_000,
      garages: [{ price: 15_000 }, { price: 14_000 }], repositories: [{ price: 5_000 }, { price: 4_000 }],
    })).toBe(238_000)
  })
})
