import { describe, it, expect } from 'vitest'
import { contractVariance } from './contractVariance'

describe('contractVariance', () => {
  describe('an open contract', () => {
    it('has no variance with nothing paid — the old "+€200.000 gain" case', () => {
      expect(contractVariance({ contracted: 200_000, paid: 0, settled: false })).toEqual({ kind: 'none' })
    })

    it('has no variance while part-paid', () => {
      expect(contractVariance({ contracted: 1000, paid: 400, settled: false })).toEqual({ kind: 'none' })
    })

    it('has no variance when paid exactly', () => {
      expect(contractVariance({ contracted: 1000, paid: 1000, settled: false })).toEqual({ kind: 'none' })
    })

    it('shows an overrun as soon as more than the contract is paid', () => {
      expect(contractVariance({ contracted: 1000, paid: 1200, settled: false })).toEqual({ kind: 'overrun', amount: 200 })
    })
  })

  describe('a settled contract', () => {
    it('shows a saving when it closed for less', () => {
      expect(contractVariance({ contracted: 1000, paid: 800, settled: true })).toEqual({ kind: 'saving', amount: 200 })
    })

    it('shows nothing when it closed at exactly the contract value', () => {
      expect(contractVariance({ contracted: 1000, paid: 1000, settled: true })).toEqual({ kind: 'none' })
    })

    it('still shows an overrun, never a saving, when it closed for more', () => {
      expect(contractVariance({ contracted: 1000, paid: 1050.5, settled: true })).toEqual({ kind: 'overrun', amount: 50.5 })
    })

    it('shows the whole value as a saving when closed with nothing paid', () => {
      expect(contractVariance({ contracted: 1000, paid: 0, settled: true })).toEqual({ kind: 'saving', amount: 1000 })
    })
  })

  describe('no contract amount', () => {
    it('has no variance at zero, whatever was paid', () => {
      expect(contractVariance({ contracted: 0, paid: 500, settled: false })).toEqual({ kind: 'none' })
      expect(contractVariance({ contracted: 0, paid: 0, settled: true })).toEqual({ kind: 'none' })
    })

    it('has no variance for a negative or missing amount', () => {
      expect(contractVariance({ contracted: -100, paid: 50, settled: true })).toEqual({ kind: 'none' })
      expect(contractVariance({ contracted: NaN, paid: 50, settled: true })).toEqual({ kind: 'none' })
    })

    it('has no variance when paid is not a number', () => {
      expect(contractVariance({ contracted: 100, paid: NaN, settled: true })).toEqual({ kind: 'none' })
    })
  })

  describe('cent rounding', () => {
    it('does not call floating-point noise an overrun', () => {
      // 0.1 + 0.2 === 0.30000000000000004
      expect(contractVariance({ contracted: 0.3, paid: 0.1 + 0.2, settled: true })).toEqual({ kind: 'none' })
      expect(contractVariance({ contracted: 100, paid: 100.000001, settled: false })).toEqual({ kind: 'none' })
    })

    it('does not call floating-point noise a saving', () => {
      expect(contractVariance({ contracted: 100, paid: 99.999999, settled: true })).toEqual({ kind: 'none' })
    })

    it('treats a sum of cent payments that adds up to the contract as exact', () => {
      const paid = [33.33, 33.33, 33.34, 0.1, 0.2].reduce((a, b) => a + b, 0)
      expect(contractVariance({ contracted: 100.3, paid, settled: true })).toEqual({ kind: 'none' })
    })

    it('reports a single cent either way', () => {
      expect(contractVariance({ contracted: 100, paid: 100.01, settled: false })).toEqual({ kind: 'overrun', amount: 0.01 })
      expect(contractVariance({ contracted: 100, paid: 99.99, settled: true })).toEqual({ kind: 'saving', amount: 0.01 })
    })

    it('returns amounts rounded to the cent', () => {
      expect(contractVariance({ contracted: 1000, paid: 1000.1 + 0.2, settled: false })).toEqual({ kind: 'overrun', amount: 0.3 })
    })
  })
})
