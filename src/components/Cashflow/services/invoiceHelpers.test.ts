import { describe, it, expect } from 'vitest'
import {
  INVOICE_CATEGORIES_BY_DIRECTION,
  isInvoiceCategoryValidForDirection,
  getInvoiceTypeLabelKey,
  type InvoiceDirection,
} from './invoiceHelpers'

// Copied from accounting_invoices_invoice_type_check in the baseline migration. Kept literal here
// (not imported) so the test fails if the matrix drifts from what the database accepts.
const DB_INVOICE_TYPES = [
  'INCOMING_SUPPLIER',
  'INCOMING_INVESTMENT',
  'INCOMING_OFFICE',
  'INCOMING_BANK',
  'INCOMING_BANK_EXPENSES',
  'OUTGOING_SUPPLIER',
  'OUTGOING_SALES',
  'OUTGOING_OFFICE',
  'OUTGOING_BANK',
]

const allCombinations = () =>
  (Object.keys(INVOICE_CATEGORIES_BY_DIRECTION) as InvoiceDirection[]).flatMap(direction =>
    INVOICE_CATEGORIES_BY_DIRECTION[direction].map(c => `${direction}_${c.value}`)
  )

describe('INVOICE_CATEGORIES_BY_DIRECTION', () => {
  it('only produces invoice types the database CHECK allows', () => {
    for (const type of allCombinations()) {
      expect(DB_INVOICE_TYPES).toContain(type)
    }
  })

  it('covers every allowed invoice type exactly once', () => {
    const combos = allCombinations()
    expect(new Set(combos).size).toBe(combos.length)
    expect([...combos].sort()).toEqual([...DB_INVOICE_TYPES].sort())
  })

  it('gives every category an invoice_type.* label key', () => {
    for (const direction of Object.keys(INVOICE_CATEGORIES_BY_DIRECTION) as InvoiceDirection[]) {
      for (const c of INVOICE_CATEGORIES_BY_DIRECTION[direction]) {
        expect(c.labelKey).toMatch(/^invoice_type\.[a-z_]+$/)
      }
    }
  })
})

describe('isInvoiceCategoryValidForDirection', () => {
  it('rejects categories that only exist in the other direction', () => {
    expect(isInvoiceCategoryValidForDirection('OUTGOING', 'INVESTMENT')).toBe(false)
    expect(isInvoiceCategoryValidForDirection('OUTGOING', 'BANK_EXPENSES')).toBe(false)
    expect(isInvoiceCategoryValidForDirection('INCOMING', 'SALES')).toBe(false)
  })

  it('accepts categories shared by both directions', () => {
    for (const category of ['SUPPLIER', 'OFFICE', 'BANK']) {
      expect(isInvoiceCategoryValidForDirection('INCOMING', category)).toBe(true)
      expect(isInvoiceCategoryValidForDirection('OUTGOING', category)).toBe(true)
    }
  })
})

describe('getInvoiceTypeLabelKey', () => {
  it('resolves every database invoice type, including INCOMING_BANK_EXPENSES', () => {
    for (const type of DB_INVOICE_TYPES) {
      expect(getInvoiceTypeLabelKey(type)).not.toBeNull()
    }
    expect(getInvoiceTypeLabelKey('INCOMING_BANK_EXPENSES')).toBe('invoice_type.ulazni_troskred')
  })

  it('returns null for an unknown type', () => {
    expect(getInvoiceTypeLabelKey('OUTGOING_INVESTMENT')).toBeNull()
  })
})
