import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import {
  paymentKind,
  INVOICE_CATEGORIES_BY_DIRECTION,
  isInvoiceCategoryValidForDirection,
  getInvoiceTypeLabelKey,
  getInvoiceStatusVariant,
  getInvoiceStatusLabelKey,
  getInvoiceStatusLabel,
  paymentDirection,
  getInvoiceCategoryLabelKey,
  getInvoiceCategoryLabel,
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

describe('getInvoiceStatusVariant', () => {
  it('matches the colours the rest of the app uses', () => {
    expect(getInvoiceStatusVariant('PAID')).toBe('green')
    expect(getInvoiceStatusVariant('PARTIALLY_PAID')).toBe('yellow')
    // Approvals once showed UNPAID yellow and PARTIALLY_PAID grey; everywhere else these are the rule.
    expect(getInvoiceStatusVariant('UNPAID')).toBe('red')
  })

  it('falls back to gray for anything else, including lowercase and missing values', () => {
    expect(getInvoiceStatusVariant('paid')).toBe('gray')
    expect(getInvoiceStatusVariant('')).toBe('gray')
    expect(getInvoiceStatusVariant(null)).toBe('gray')
    expect(getInvoiceStatusVariant(undefined)).toBe('gray')
  })
})

describe('getInvoiceStatusLabelKey', () => {
  it('maps each known status to its shared common.* key', () => {
    expect(getInvoiceStatusLabelKey('PAID')).toBe('common.paid')
    expect(getInvoiceStatusLabelKey('PARTIALLY_PAID')).toBe('common.partial')
    expect(getInvoiceStatusLabelKey('UNPAID')).toBe('common.unpaid')
  })

  it('returns null for an unknown status so the caller decides the fallback', () => {
    expect(getInvoiceStatusLabelKey('OVERDUE')).toBeNull()
    expect(getInvoiceStatusLabelKey(null)).toBeNull()
  })
})

describe('paymentDirection', () => {
  it('treats paying an OUTGOING_* invoice as money in, e.g. a credit drawdown', () => {
    for (const type of DB_INVOICE_TYPES.filter(t => t.startsWith('OUTGOING_'))) {
      expect(paymentDirection(type)).toBe('IN')
    }
    expect(paymentDirection('OUTGOING_BANK')).toBe('IN')
  })

  it('treats paying an INCOMING_* invoice as money out, e.g. a repayment or credit fees', () => {
    for (const type of DB_INVOICE_TYPES.filter(t => t.startsWith('INCOMING_'))) {
      expect(paymentDirection(type)).toBe('OUT')
    }
    expect(paymentDirection('INCOMING_BANK')).toBe('OUT')
    expect(paymentDirection('INCOMING_BANK_EXPENSES')).toBe('OUT')
  })

  it('gives every database invoice type a direction', () => {
    for (const type of DB_INVOICE_TYPES) {
      expect(paymentDirection(type)).not.toBeNull()
    }
  })

  it('returns null when the type carries neither prefix', () => {
    expect(paymentDirection('BANK')).toBeNull()
    expect(paymentDirection(null)).toBeNull()
    expect(paymentDirection(undefined)).toBeNull()
  })
})

describe('getInvoiceStatusLabel', () => {
  const t = ((key: string) => `t(${key})`) as unknown as TFunction

  it('translates a known status through its shared key', () => {
    expect(getInvoiceStatusLabel('UNPAID', t)).toBe('t(common.unpaid)')
  })

  it('shows an unknown status as-is, and a missing one as the no-value dash', () => {
    expect(getInvoiceStatusLabel('OVERDUE', t)).toBe('OVERDUE')
    expect(getInvoiceStatusLabel(null, t)).toBe('—')
  })
})

describe('getInvoiceCategoryLabel', () => {
  const t = ((key: string) => `t(${key})`) as unknown as TFunction

  // Copied from accounting_invoices_invoice_category_check (baseline_schema.sql:2523), literal for
  // the same reason as DB_INVOICE_TYPES above.
  const DB_INVOICE_CATEGORIES = [
    'SUBCONTRACTOR', 'OFFICE', 'APARTMENT', 'CUSTOMER', 'BANK_CREDIT',
    'INVESTOR', 'MISCELLANEOUS', 'GENERAL', 'RETAIL',
  ]

  it('has a key for every category the CHECK constraint allows', () => {
    for (const category of DB_INVOICE_CATEGORIES) {
      expect(getInvoiceCategoryLabelKey(category)).toBe(`invoice_category.${category.toLowerCase()}`)
    }
  })

  // 'SUPERVISION' was branched on in Supervision/Invoices for a blue badge, but no CHECK has ever
  // allowed it and no migration ever added it. It must not acquire a label by accident.
  it('does not know SUPERVISION, which the database has never allowed', () => {
    expect(getInvoiceCategoryLabelKey('SUPERVISION')).toBeNull()
  })

  it('shows an unknown category as-is, and a missing one as the no-value dash', () => {
    expect(getInvoiceCategoryLabel('SUBCONTRACTOR', t)).toBe('t(invoice_category.subcontractor)')
    expect(getInvoiceCategoryLabel('SUPERVISION', t)).toBe('SUPERVISION')
    expect(getInvoiceCategoryLabel(null, t)).toBe('—')
  })
})

describe('spelled-out invoice type labels', () => {
  it('has a short and a long label in both locales for every database invoice type', async () => {
    const { getInvoiceTypeLongLabelKey, ALL_INVOICE_TYPES } = await import('./invoiceHelpers')
    const hr = (await import('../../../locales/hr/translation.json')).default as unknown as Record<string, Record<string, string>>
    const en = (await import('../../../locales/en/translation.json')).default as unknown as Record<string, Record<string, string>>
    expect([...ALL_INVOICE_TYPES].sort()).toEqual([...DB_INVOICE_TYPES].sort())
    for (const type of DB_INVOICE_TYPES) {
      const short = (getInvoiceTypeLabelKey(type) as string).split('.')
      const long = (getInvoiceTypeLongLabelKey(type) as string).split('.')
      expect(long[0]).toBe('invoice_type_long')
      for (const bundle of [hr, en]) {
        expect(bundle[short[0]][short[1]], `${type} short`).toBeTruthy()
        expect(bundle[long[0]][long[1]], `${type} long`).toBeTruthy()
      }
    }
  })
})

describe('paymentKind', () => {
  // Credit principal is financing, neither income nor expense (CASH-7). The payment registers
  // filed a drawdown under PRIHOD and a repayment under RASHOD (FUND-17).
  it('names credit principal as financing in both directions', () => {
    expect(paymentKind('OUTGOING_BANK')).toEqual({ labelKey: 'payments.table.credit_drawdown', financing: true })
    expect(paymentKind('INCOMING_BANK')).toEqual({ labelKey: 'payments.table.principal_repayment', financing: true })
  })

  it('keeps credit fees and every other invoice as expense or income', () => {
    expect(paymentKind('INCOMING_BANK_EXPENSES')).toEqual({ labelKey: 'payments.table.expense', financing: false })
    expect(paymentKind('INCOMING_SUPPLIER')?.labelKey).toBe('payments.table.expense')
    expect(paymentKind('OUTGOING_SALES')).toEqual({ labelKey: 'payments.table.income', financing: false })
  })

  it('has no answer for a type the cash map does not know', () => {
    expect(paymentKind(null)).toBeNull()
    expect(paymentKind('SOMETHING_NEW')).toBeNull()
  })
})
