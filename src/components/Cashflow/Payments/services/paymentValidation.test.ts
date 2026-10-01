import { describe, it, expect } from 'vitest'
import { validatePaymentForm, type PaymentValidationInput } from './paymentValidation'

const valid: PaymentValidationInput = {
  amount: 100,
  payment_source_type: 'bank_account',
  is_cesija: false,
  payment_method: 'WIRE',
  company_bank_account_id: 'ba-1',
  credit_id: '',
  credit_allocation_id: '',
  cesija_company_id: '',
  cesija_bank_account_id: '',
  cesija_credit_id: '',
  cesija_credit_allocation_id: '',
}

describe('validatePaymentForm', () => {
  it('accepts a complete bank-account payment', () => {
    expect(validatePaymentForm(valid, { remainingAmount: 100 })).toBeNull()
  })

  describe('amount', () => {
    it.each([0, -5, Number.NaN, 'abc'])('rejects %s', (amount) => {
      expect(validatePaymentForm({ ...valid, amount })).toBe('payments.form.error_amount_required')
    })

    it('accepts a numeric string', () => {
      expect(validatePaymentForm({ ...valid, amount: '50' }, { remainingAmount: 100 })).toBeNull()
    })

    it('rejects an amount above the remaining amount', () => {
      expect(validatePaymentForm({ ...valid, amount: 100.01 }, { remainingAmount: 100 }))
        .toBe('payments.form.error_amount_exceeds_remaining')
    })

    it('skips the remaining check when the invoice is unknown', () => {
      expect(validatePaymentForm({ ...valid, amount: 1e9 })).toBeNull()
    })

    it('is not fooled by float noise on an exact full payment', () => {
      expect(validatePaymentForm({ ...valid, amount: 0.3 }, { remainingAmount: 0.1 + 0.2 })).toBeNull()
      expect(validatePaymentForm({ ...valid, amount: 0.1 + 0.2 }, { remainingAmount: 0.3 })).toBeNull()
    })

    it('adds the original amount back when editing a payment on a fully paid invoice', () => {
      // Invoice of 100 fully paid by this one payment: remaining_amount is 0.
      expect(validatePaymentForm({ ...valid, amount: 100 }, { remainingAmount: 0, originalAmount: 100 })).toBeNull()
      expect(validatePaymentForm({ ...valid, amount: 80 }, { remainingAmount: 0, originalAmount: 100 })).toBeNull()
      expect(validatePaymentForm({ ...valid, amount: 100.5 }, { remainingAmount: 0, originalAmount: 100 }))
        .toBe('payments.form.error_amount_exceeds_remaining')
    })
  })

  describe('own source', () => {
    it('requires a bank account', () => {
      expect(validatePaymentForm({ ...valid, company_bank_account_id: '' }))
        .toBe('payments.form.error_bank_account_required')
    })

    it('requires a credit, then its allocation, as separate messages', () => {
      const credit = { ...valid, payment_source_type: 'credit', company_bank_account_id: '' }
      expect(validatePaymentForm(credit)).toBe('payments.form.error_credit_required')
      expect(validatePaymentForm({ ...credit, credit_id: 'cr-1' }))
        .toBe('payments.form.error_credit_allocation_required')
      expect(validatePaymentForm({ ...credit, credit_id: 'cr-1', credit_allocation_id: 'ca-1' })).toBeNull()
    })

    it('needs no account for kompenzacija or gotovina', () => {
      expect(validatePaymentForm({ ...valid, payment_source_type: 'kompenzacija', company_bank_account_id: '' })).toBeNull()
      expect(validatePaymentForm({ ...valid, payment_source_type: 'gotovina', payment_method: 'CASH', company_bank_account_id: '' })).toBeNull()
    })
  })

  describe('cesija', () => {
    const cesija = { ...valid, is_cesija: true, company_bank_account_id: '' }

    it('requires the paying company first', () => {
      expect(validatePaymentForm(cesija)).toBe('payments.form.error_cesija_company_required')
    })

    it('requires the cesija bank account for a bank-account source', () => {
      expect(validatePaymentForm({ ...cesija, cesija_company_id: 'c-1' }))
        .toBe('payments.form.error_bank_account_required')
      expect(validatePaymentForm({ ...cesija, cesija_company_id: 'c-1', cesija_bank_account_id: 'cba-1' })).toBeNull()
    })

    it('requires the cesija credit, then its allocation, for a credit source', () => {
      const credit = { ...cesija, payment_source_type: 'credit', cesija_company_id: 'c-1' }
      expect(validatePaymentForm(credit)).toBe('payments.form.error_credit_required')
      expect(validatePaymentForm({ ...credit, cesija_credit_id: 'ccr-1' }))
        .toBe('payments.form.error_credit_allocation_required')
      expect(validatePaymentForm({ ...credit, cesija_credit_id: 'ccr-1', cesija_credit_allocation_id: 'cca-1' })).toBeNull()
    })

    it('ignores the own-source account fields', () => {
      expect(validatePaymentForm({ ...cesija, cesija_company_id: 'c-1', cesija_bank_account_id: 'cba-1', credit_id: '' })).toBeNull()
    })
  })

  describe('method vs source', () => {
    it('rejects a wire recorded against gotovina', () => {
      expect(validatePaymentForm({ ...valid, payment_source_type: 'gotovina', payment_method: 'WIRE' }))
        .toBe('payments.form.error_method_mismatch')
    })

    it('rejects cash from a bank account or a credit', () => {
      expect(validatePaymentForm({ ...valid, payment_method: 'CASH' })).toBe('payments.form.error_method_mismatch')
      expect(validatePaymentForm({
        ...valid, payment_source_type: 'credit', credit_id: 'cr-1', credit_allocation_id: 'ca-1', payment_method: 'CARD',
      })).toBe('payments.form.error_method_mismatch')
    })

    it('only allows WIRE for cesija', () => {
      const cesija = { ...valid, is_cesija: true, cesija_company_id: 'c-1', cesija_bank_account_id: 'cba-1' }
      expect(validatePaymentForm({ ...cesija, payment_method: 'CARD' })).toBe('payments.form.error_method_mismatch')
      expect(validatePaymentForm({ ...cesija, payment_method: 'WIRE' })).toBeNull()
    })

    it('never rejects the placeholder method on kompenzacija', () => {
      for (const payment_method of ['WIRE', 'CASH', 'CHECK', 'CARD']) {
        expect(validatePaymentForm({ ...valid, payment_source_type: 'kompenzacija', payment_method })).toBeNull()
      }
    })

    it('reports missing fields before a method mismatch', () => {
      expect(validatePaymentForm({ ...valid, company_bank_account_id: '', payment_method: 'CASH' }))
        .toBe('payments.form.error_bank_account_required')
    })
  })
})
