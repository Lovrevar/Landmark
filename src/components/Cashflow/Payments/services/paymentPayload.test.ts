import { describe, it, expect } from 'vitest'
import { buildPaymentData } from './paymentPayload'
import type { PaymentFormData } from '../types'

// A fully-populated form. Each test flips the discriminating fields and asserts
// that the *irrelevant* references get nulled out — that is the whole point of
// the cesija/kompenzacija branching.
const base: PaymentFormData = {
  invoice_id: 'inv-1',
  payment_source_type: 'bank_account',
  company_bank_account_id: 'ba-1',
  credit_id: 'cr-1',
  credit_allocation_id: 'ca-1',
  is_cesija: false,
  cesija_company_id: 'cc-1',
  cesija_bank_account_id: 'cba-1',
  cesija_credit_id: 'ccr-1',
  cesija_credit_allocation_id: 'cca-1',
  payment_date: '2026-05-01',
  amount: 1000,
  payment_method: 'WIRE',
  reference_number: 'REF-1',
  description: 'desc',
}

describe('buildPaymentData', () => {
  describe('normal bank-account payment', () => {
    it('keeps the bank account, nulls credit and all cesija fields', () => {
      const r = buildPaymentData(base, 'user-1')
      expect(r.payment_source_type).toBe('bank_account')
      expect(r.company_bank_account_id).toBe('ba-1')
      expect(r.credit_id).toBeNull()
      expect(r.is_cesija).toBe(false)
      expect(r.cesija_company_id).toBeNull()
      expect(r.cesija_bank_account_id).toBeNull()
    })
  })

  describe('credit payment', () => {
    it('keeps the credit and its allocation, nulls the bank account', () => {
      const r = buildPaymentData({ ...base, payment_source_type: 'credit' }, 'user-1')
      expect(r.payment_source_type).toBe('credit')
      expect(r.credit_id).toBe('cr-1')
      expect(r.credit_allocation_id).toBe('ca-1')
      expect(r.company_bank_account_id).toBeNull()
    })
  })

  describe('kompenzacija (mutual debt offset)', () => {
    it('keeps the source as kompenzacija but nulls both bank account and credit (no money moves)', () => {
      const r = buildPaymentData({ ...base, payment_source_type: 'kompenzacija' }, 'user-1')
      expect(r.payment_source_type).toBe('kompenzacija')
      expect(r.company_bank_account_id).toBeNull()
      expect(r.credit_id).toBeNull()
      expect(r.is_cesija).toBe(false)
      expect(r.cesija_company_id).toBeNull()
    })
  })

  describe('gotovina (cash)', () => {
    it('keeps the source as gotovina and nulls bank account and credit references', () => {
      const r = buildPaymentData({ ...base, payment_source_type: 'gotovina' }, 'user-1')
      expect(r.payment_source_type).toBe('gotovina')
      expect(r.company_bank_account_id).toBeNull()
      expect(r.credit_id).toBeNull()
    })
  })

  describe('cesija (third-party debt assignment)', () => {
    it('bank-account-funded cesija: nulls own bank/credit, carries cesija bank account, nulls cesija credit', () => {
      const r = buildPaymentData({ ...base, is_cesija: true }, 'user-1')
      expect(r.is_cesija).toBe(true)
      expect(r.payment_source_type).toBe('bank_account')
      expect(r.company_bank_account_id).toBeNull()
      expect(r.credit_id).toBeNull()
      expect(r.credit_allocation_id).toBeNull()
      expect(r.cesija_company_id).toBe('cc-1')
      expect(r.cesija_bank_account_id).toBe('cba-1')
      expect(r.cesija_credit_id).toBeNull()
      expect(r.cesija_credit_allocation_id).toBeNull()
    })

    it('credit-funded cesija: preserves the credit source and carries cesija credit + allocation', () => {
      const r = buildPaymentData({ ...base, is_cesija: true, payment_source_type: 'credit' }, 'user-1')
      // payment_source_type now carries the cesija funding source (matches invoiceService)
      expect(r.payment_source_type).toBe('credit')
      // own (non-cesija) credit references are nulled because this is a cesija
      expect(r.credit_id).toBeNull()
      expect(r.credit_allocation_id).toBeNull()
      // the cesija bank account is nulled because the cesija source is credit
      expect(r.cesija_bank_account_id).toBeNull()
      expect(r.cesija_company_id).toBe('cc-1')
      expect(r.cesija_credit_id).toBe('ccr-1')
      expect(r.cesija_credit_allocation_id).toBe('cca-1')
    })
  })

  describe('empty-string normalisation to null', () => {
    it('coerces a blank bank-account id to null', () => {
      const r = buildPaymentData({ ...base, company_bank_account_id: '' }, 'user-1')
      expect(r.company_bank_account_id).toBeNull()
    })

    it('coerces blank cesija ids to null', () => {
      const r = buildPaymentData({ ...base, is_cesija: true, cesija_company_id: '', cesija_bank_account_id: '' }, 'user-1')
      expect(r.cesija_company_id).toBeNull()
      expect(r.cesija_bank_account_id).toBeNull()
    })

    it('coerces a blank reference number to null', () => {
      const r = buildPaymentData({ ...base, reference_number: '' }, 'user-1')
      expect(r.reference_number).toBeNull()
    })
  })

  describe('passthrough fields', () => {
    it('copies invoice/date/amount/method/description verbatim and threads created_by', () => {
      const r = buildPaymentData(base, 'user-42')
      expect(r.invoice_id).toBe('inv-1')
      expect(r.payment_date).toBe('2026-05-01')
      expect(r.amount).toBe(1000)
      expect(r.payment_method).toBe('WIRE')
      expect(r.description).toBe('desc')
      expect(r.reference_number).toBe('REF-1')
      expect(r.created_by).toBe('user-42')
    })

    it('passes through an undefined creator (unauthenticated edge case)', () => {
      expect(buildPaymentData(base, undefined).created_by).toBeUndefined()
    })
  })
})
