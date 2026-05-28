import { describe, it, expect } from 'vitest'
import {
  getPaymentFrequency,
  calculateAnnuityPayment,
  calculateEquityCashflow,
  calculateMoneyMultiple,
  parseCreditTypeAndSeniority,
  getCreditRiskLevel,
  getCreditTypeBadgeVariant,
  calculatePaymentSchedule,
} from './creditCalculations'

describe('getPaymentFrequency', () => {
  it('maps each known type to its payments-per-year count', () => {
    expect(getPaymentFrequency('monthly')).toBe(12)
    expect(getPaymentFrequency('quarterly')).toBe(4)
    expect(getPaymentFrequency('biyearly')).toBe(2)
    expect(getPaymentFrequency('yearly')).toBe(1)
  })

  it('defaults unknown values to monthly (12)', () => {
    expect(getPaymentFrequency('weekly')).toBe(12)
    expect(getPaymentFrequency('')).toBe(12)
  })
})

describe('calculateAnnuityPayment', () => {
  const baseParams = {
    amount: 120_000,
    interest_rate: 0,
    grace_period: 0,
    start_date: '2026-01-01',
    maturity_date: '2036-01-01', // 10 years
    repayment_type: 'monthly' as const,
  }

  // Note: maturityYears = (ms_diff) / (365.25 days * ms_per_day).
  // For 2026-01-01 → 2036-01-01 (3652 actual days, includes 2 leap years),
  // this yields ~9.9986 years — slightly under 10. All payment values below
  // are anchored to the code's actual output, not the textbook ideal.

  it('zero interest, monthly: payment ≈ principal / (years * 12)', () => {
    const payment = calculateAnnuityPayment(baseParams)
    // 120_000 / (9.9986 * 12) ≈ 1000.14
    expect(payment).toBeGreaterThan(999.5)
    expect(payment).toBeLessThan(1001)
  })

  it('zero interest, yearly: payment ≈ principal / years', () => {
    const payment = calculateAnnuityPayment({ ...baseParams, repayment_type: 'yearly' })
    expect(payment).toBeGreaterThan(11_995)
    expect(payment).toBeLessThan(12_010)
  })

  it('5% interest, monthly: matches standard amortization formula (~1060.77)', () => {
    const payment = calculateAnnuityPayment({
      ...baseParams,
      amount: 100_000,
      interest_rate: 5,
    })
    expect(payment).toBeCloseTo(1060.77, 1)
  })

  it('5% interest, yearly: matches yearly amortization formula (~12951.83)', () => {
    const payment = calculateAnnuityPayment({
      ...baseParams,
      amount: 100_000,
      interest_rate: 5,
      repayment_type: 'yearly',
    })
    expect(payment).toBeCloseTo(12_951.83, 1)
  })

  it('grace period extends amortization base — higher payment than without grace', () => {
    const withoutGrace = calculateAnnuityPayment({ ...baseParams, amount: 100_000, interest_rate: 5 })
    const withGrace    = calculateAnnuityPayment({ ...baseParams, amount: 100_000, interest_rate: 5, grace_period: 12 })
    // With 12-month grace, payments are spread over 9 years → each payment is higher.
    expect(withGrace).toBeGreaterThan(withoutGrace)
  })

  it('defaults to 10-year maturity when maturity_date is null', () => {
    // getMaturityYears returns exactly 10 in the null-default branch, so this is the
    // one clean case where the textbook division holds exactly.
    const payment = calculateAnnuityPayment({
      ...baseParams,
      amount: 120_000,
      maturity_date: null,
    })
    expect(payment).toBeCloseTo(120_000 / (10 * 12), 1)
  })
})

describe('calculateEquityCashflow', () => {
  const baseEquity = {
    amount: 100_000,
    expected_return: 8,
    grace_period: 0,
    investment_date: '2026-01-01',
    maturity_date: '2036-01-01',
    payment_schedule: 'yearly' as const,
  }

  it('returns sentinel string when required fields are missing', () => {
    expect(calculateEquityCashflow({ ...baseEquity, amount: 0 })).toBe('Enter amount, dates, and IRR to calculate')
    expect(calculateEquityCashflow({ ...baseEquity, investment_date: '' })).toBe('Enter amount, dates, and IRR to calculate')
    expect(calculateEquityCashflow({ ...baseEquity, maturity_date: '' })).toBe('Enter amount, dates, and IRR to calculate')
    expect(calculateEquityCashflow({ ...baseEquity, expected_return: 0 })).toBe('Enter amount, dates, and IRR to calculate')
  })

  it('returns "Invalid date range" when maturity is before investment', () => {
    expect(calculateEquityCashflow({ ...baseEquity, maturity_date: '2025-01-01' })).toBe('Invalid date range')
  })

  it('returns a localized number string for valid inputs', () => {
    const result = calculateEquityCashflow(baseEquity)
    // Should be a parse-able formatted integer — not a sentinel
    expect(result).not.toContain('Enter')
    expect(result).not.toContain('Invalid')
    // Strip locale separators and parse
    const numeric = Number(result.replace(/[^\d.-]/g, ''))
    expect(numeric).toBeGreaterThan(0)
  })
})

describe('calculateMoneyMultiple', () => {
  const baseEquity = {
    amount: 100_000,
    expected_return: 10,
    investment_date: '2026-01-01',
    maturity_date: '2036-01-01', // 10 years
  }

  it('returns sentinel when inputs are incomplete', () => {
    expect(calculateMoneyMultiple({ ...baseEquity, amount: 0 })).toBe('Enter amount, dates, and IRR to calculate')
    expect(calculateMoneyMultiple({ ...baseEquity, expected_return: 0 })).toBe('Enter amount, dates, and IRR to calculate')
  })

  it('returns "Invalid date range" for maturity before investment', () => {
    expect(calculateMoneyMultiple({ ...baseEquity, maturity_date: '2020-01-01' })).toBe('Invalid date range')
  })

  it('computes (1 + rate)^years — 10% over 10y ≈ 2.59x', () => {
    // (1.10)^10 = 2.5937...
    expect(calculateMoneyMultiple(baseEquity)).toBe('2.59x (259%)')
  })

  it('computes 0% return as 1.00x', () => {
    // expected_return must be truthy to pass the guard, so use a tiny positive value.
    const result = calculateMoneyMultiple({ ...baseEquity, expected_return: 0.0001 })
    expect(result.startsWith('1.00x')).toBe(true)
  })

  it('computes 5% over 1 year ≈ 1.05x', () => {
    const result = calculateMoneyMultiple({
      ...baseEquity,
      expected_return: 5,
      maturity_date: '2027-01-01',
    })
    expect(result).toBe('1.05x (105%)')
  })
})

describe('parseCreditTypeAndSeniority', () => {
  it('splits combined string on the last underscore', () => {
    expect(parseCreditTypeAndSeniority('construction_loan_senior')).toEqual({
      creditType: 'construction_loan',
      seniority: 'senior',
    })
  })

  it('handles multi-word credit type with single seniority', () => {
    expect(parseCreditTypeAndSeniority('term_loan_junior')).toEqual({
      creditType: 'term_loan',
      seniority: 'junior',
    })
  })

  it('handles single-word input (creditType becomes empty)', () => {
    expect(parseCreditTypeAndSeniority('senior')).toEqual({ creditType: '', seniority: 'senior' })
  })
})

describe('getCreditRiskLevel', () => {
  it('returns High above 80', () => {
    expect(getCreditRiskLevel(81).label).toBe('High')
    expect(getCreditRiskLevel(100).label).toBe('High')
  })

  it('returns Medium for >60 and ≤80 (boundary at 60 is Low, at 80 is Medium)', () => {
    expect(getCreditRiskLevel(61).label).toBe('Medium')
    expect(getCreditRiskLevel(80).label).toBe('Medium')
  })

  it('returns Low at and below 60', () => {
    expect(getCreditRiskLevel(60).label).toBe('Low')
    expect(getCreditRiskLevel(0).label).toBe('Low')
    expect(getCreditRiskLevel(-10).label).toBe('Low')
  })

  it('returns matching tailwind className per tier', () => {
    expect(getCreditRiskLevel(90).className).toBe('text-red-600')
    expect(getCreditRiskLevel(70).className).toBe('text-orange-600')
    expect(getCreditRiskLevel(10).className).toBe('text-green-600')
  })
})

describe('getCreditTypeBadgeVariant', () => {
  it('maps known credit types to their badge variants', () => {
    expect(getCreditTypeBadgeVariant('construction_loan')).toBe('blue')
    expect(getCreditTypeBadgeVariant('term_loan')).toBe('green')
    expect(getCreditTypeBadgeVariant('bridge_loan')).toBe('orange')
  })

  it('defaults unknown types to gray', () => {
    expect(getCreditTypeBadgeVariant('unknown')).toBe('gray')
    expect(getCreditTypeBadgeVariant('')).toBe('gray')
  })
})

describe('calculatePaymentSchedule', () => {
  const baseParams = {
    start_date: '2026-01-01',
    maturity_date: '2036-01-01', // 10 years
    amount: 120_000,
    grace_period: 0,
    interest_rate: 6,
    principal_repayment_type: 'monthly',
    interest_repayment_type: 'monthly',
  }

  it('returns null when required dates or amount are missing', () => {
    expect(calculatePaymentSchedule({ ...baseParams, start_date: '' })).toBeNull()
    expect(calculatePaymentSchedule({ ...baseParams, maturity_date: '' })).toBeNull()
    expect(calculatePaymentSchedule({ ...baseParams, amount: 0 })).toBeNull()
  })

  it('returns null when grace_period exceeds the term (paymentStartDate ≥ endDate)', () => {
    expect(calculatePaymentSchedule({ ...baseParams, grace_period: 12 * 11 })).toBeNull()
  })

  // Quirk worth knowing: a clean 10-year loan computes as 119 monthly principal
  // payments (not 120) because Math.floor(9.9986 * 12) = 119. Per-payment principal
  // is therefore 120_000 / 119 ≈ 1008.40, not the intuitive 1000. If the business
  // expects 120 payments, this is a real off-by-one in the code.
  it('computes monthly principal: 120k / floor(9.9986 * 12) ≈ 1008.40', () => {
    const result = calculatePaymentSchedule(baseParams)
    expect(result).not.toBeNull()
    expect(result!.totalPrincipalPayments).toBe(119)
    expect(result!.principalPerPayment).toBeCloseTo(120_000 / 119, 1)
  })

  it('computes monthly interest from annual rate / 12', () => {
    const result = calculatePaymentSchedule(baseParams)
    // annual interest = 120000 * 0.06 = 7200; monthly = 600
    expect(result!.interestPerPayment).toBeCloseTo(600, 1)
  })

  it('grace period shifts the paymentStartDate forward by N months', () => {
    const result = calculatePaymentSchedule({ ...baseParams, grace_period: 6 })
    expect(result).not.toBeNull()
    expect(result!.paymentStartDate.getFullYear()).toBe(2026)
    expect(result!.paymentStartDate.getMonth()).toBe(6) // July (0-indexed)
  })

  it('different repayment frequencies produce different payment counts', () => {
    const monthly = calculatePaymentSchedule(baseParams)
    const yearly  = calculatePaymentSchedule({ ...baseParams, principal_repayment_type: 'yearly' })
    expect(monthly!.totalPrincipalPayments).toBeGreaterThan(yearly!.totalPrincipalPayments)
    // 10 years × 1 = ~10 yearly principal payments
    expect(yearly!.totalPrincipalPayments).toBeGreaterThanOrEqual(9)
    expect(yearly!.totalPrincipalPayments).toBeLessThanOrEqual(10)
  })

  it('exposes the human-readable frequency labels', () => {
    const result = calculatePaymentSchedule(baseParams)
    expect(result!.principalFrequency).toBe('month')
    expect(result!.interestFrequency).toBe('month')

    const quarterly = calculatePaymentSchedule({
      ...baseParams,
      principal_repayment_type: 'quarterly',
    })
    expect(quarterly!.principalFrequency).toBe('quarter')
  })
})
