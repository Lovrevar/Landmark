import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { allowedPaymentMethods, snapPaymentMethod, getPaymentMethodLabel, getPaymentMethodLabelKey } from './paymentHelpers'

const t = ((key: string) => `t:${key}`) as unknown as TFunction

// Values allowed by accounting_payments_payment_method_check in the baseline migration.
const DB_PAYMENT_METHODS = ['WIRE', 'CASH', 'CHECK', 'CARD']

describe('allowedPaymentMethods', () => {
  it.each([
    ['bank_account', ['WIRE', 'CARD', 'CHECK']],
    ['credit', ['WIRE']],
    ['gotovina', ['CASH']],
    ['kompenzacija', []],
  ])('%s → %j', (source, expected) => {
    expect(allowedPaymentMethods(source, false)).toEqual(expected)
  })

  it('allows only WIRE for cesija, whatever the source', () => {
    for (const source of ['bank_account', 'credit', 'gotovina', 'kompenzacija']) {
      expect(allowedPaymentMethods(source, true)).toEqual(['WIRE'])
    }
  })

  it('allows every method for an unknown source rather than blocking a save', () => {
    expect(allowedPaymentMethods(undefined, false)).toEqual(DB_PAYMENT_METHODS)
    expect(allowedPaymentMethods(null, false)).toEqual(DB_PAYMENT_METHODS)
  })

  it('only ever returns values the database CHECK accepts', () => {
    for (const source of ['bank_account', 'credit', 'gotovina', 'kompenzacija', undefined]) {
      for (const isCesija of [false, true]) {
        for (const method of allowedPaymentMethods(source, isCesija)) {
          expect(DB_PAYMENT_METHODS).toContain(method)
        }
      }
    }
  })
})

describe('snapPaymentMethod', () => {
  it('keeps a method that is still allowed', () => {
    expect(snapPaymentMethod('CARD', 'bank_account', false)).toBe('CARD')
  })

  it('moves to the first allowed method otherwise', () => {
    expect(snapPaymentMethod('WIRE', 'gotovina', false)).toBe('CASH')
    expect(snapPaymentMethod('CASH', 'bank_account', false)).toBe('WIRE')
    expect(snapPaymentMethod('CARD', 'credit', false)).toBe('WIRE')
    expect(snapPaymentMethod('CASH', 'gotovina', true)).toBe('WIRE')
  })

  it('stores the WIRE placeholder for kompenzacija', () => {
    expect(snapPaymentMethod('CASH', 'kompenzacija', false)).toBe('WIRE')
  })
})

describe('getPaymentMethodLabel', () => {
  it('shows a dash for kompenzacija, whatever placeholder is stored', () => {
    expect(getPaymentMethodLabel('WIRE', 'kompenzacija', t)).toBe('—')
    expect(getPaymentMethodLabelKey('WIRE', 'kompenzacija')).toBeNull()
  })

  it('labels the method for other sources and when no source is given', () => {
    expect(getPaymentMethodLabel('CASH', 'gotovina', t)).toBe('t:payments.method_cash')
    expect(getPaymentMethodLabel('WIRE', null, t)).toBe('t:payments.method_wire')
  })

  // The labels were hardcoded Croatian, so an English UI read "Virman"/"Ček".
  it('has a key for every method the CHECK constraint allows', () => {
    for (const method of DB_PAYMENT_METHODS) {
      expect(getPaymentMethodLabelKey(method, 'bank_account')).toMatch(/^payments\.method_/)
    }
  })

  it('shows an unknown method as-is rather than hiding it', () => {
    expect(getPaymentMethodLabel('SEPA', 'bank_account', t)).toBe('SEPA')
    expect(getPaymentMethodLabel(null, 'bank_account', t)).toBe('—')
  })
})
