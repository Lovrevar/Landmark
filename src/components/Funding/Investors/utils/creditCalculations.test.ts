import { describe, it, expect } from 'vitest'
import {
  getPaymentFrequency,
  calculateAnnuityPayment,
  calculateEquityCashflow,
  calculateMoneyMultiple,
  parseCreditTypeAndSeniority,
  getCreditRiskLevel,
  utilisationTone,
  utilisationToneRgb,
  getCreditTypeBadgeVariant,
  getCreditTypeLabelKey,
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

  // The reason is reported as a status, not as an English sentence — the modal supplies the
  // words, so a Croatian user no longer reads "Enter amount, dates, and IRR to calculate".
  it('reports incomplete when required fields are missing', () => {
    expect(calculateEquityCashflow({ ...baseEquity, amount: 0 })).toEqual({ status: 'incomplete' })
    expect(calculateEquityCashflow({ ...baseEquity, investment_date: '' })).toEqual({ status: 'incomplete' })
    expect(calculateEquityCashflow({ ...baseEquity, maturity_date: '' })).toEqual({ status: 'incomplete' })
    expect(calculateEquityCashflow({ ...baseEquity, expected_return: 0 })).toEqual({ status: 'incomplete' })
  })

  it('reports invalid_range when maturity is before investment', () => {
    expect(calculateEquityCashflow({ ...baseEquity, maturity_date: '2025-01-01' })).toEqual({ status: 'invalid_range' })
  })

  it('returns a localized number string for valid inputs', () => {
    const result = calculateEquityCashflow(baseEquity)
    expect(result.status).toBe('ok')
    // Strip locale separators and parse
    const numeric = Number((result as { value: string }).value.replace(/[^\d.-]/g, ''))
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

  it('reports incomplete when inputs are incomplete', () => {
    expect(calculateMoneyMultiple({ ...baseEquity, amount: 0 })).toEqual({ status: 'incomplete' })
    expect(calculateMoneyMultiple({ ...baseEquity, expected_return: 0 })).toEqual({ status: 'incomplete' })
  })

  it('reports invalid_range for maturity before investment', () => {
    expect(calculateMoneyMultiple({ ...baseEquity, maturity_date: '2020-01-01' })).toEqual({ status: 'invalid_range' })
  })

  it('computes (1 + rate)^years — 10% over 10y ≈ 2.59x', () => {
    // (1.10)^10 = 2.5937...
    expect(calculateMoneyMultiple(baseEquity)).toEqual({ status: 'ok', value: '2.59x (259%)' })
  })

  it('computes 0% return as 1.00x', () => {
    // expected_return must be truthy to pass the guard, so use a tiny positive value.
    const result = calculateMoneyMultiple({ ...baseEquity, expected_return: 0.0001 })
    expect((result as { value: string }).value.startsWith('1.00x')).toBe(true)
  })

  it('computes 5% over 1 year ≈ 1.05x', () => {
    const result = calculateMoneyMultiple({
      ...baseEquity,
      expected_return: 5,
      maturity_date: '2027-01-01',
    })
    expect(result).toEqual({ status: 'ok', value: '1.05x (105%)' })
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
  // `level` is a `RISK_LEVEL` key, not a label: the badge wording comes from statusDisplay, the
  // bands stay where they are (looser than `utilisationTone`'s, deliberately).
  it('returns High above 80', () => {
    expect(getCreditRiskLevel(81).level).toBe('High')
    expect(getCreditRiskLevel(100).level).toBe('High')
  })

  it('returns Medium for >60 and ≤80 (boundary at 60 is Low, at 80 is Medium)', () => {
    expect(getCreditRiskLevel(61).level).toBe('Medium')
    expect(getCreditRiskLevel(80).level).toBe('Medium')
  })

  it('returns Low at and below 60', () => {
    expect(getCreditRiskLevel(60).level).toBe('Low')
    expect(getCreditRiskLevel(0).level).toBe('Low')
    expect(getCreditRiskLevel(-10).level).toBe('Low')
  })

  it('returns matching tailwind className per tier', () => {
    expect(getCreditRiskLevel(90).className).toBe('text-red-600')
    expect(getCreditRiskLevel(70).className).toBe('text-orange-600')
    expect(getCreditRiskLevel(10).className).toBe('text-green-600')
  })
})

describe('utilisationTone', () => {
  it('is red at and above 90', () => {
    expect(utilisationTone(90).bar).toBe('bg-red-600 dark:bg-red-500')
    expect(utilisationTone(150).text).toBe('text-red-600 dark:text-red-400')
  })

  it('is orange from 70 up to but not including 90', () => {
    expect(utilisationTone(70).bar).toBe('bg-orange-600 dark:bg-orange-500')
    expect(utilisationTone(89.9).text).toBe('text-orange-600 dark:text-orange-400')
  })

  it('is green below 70, including 0 and negatives', () => {
    expect(utilisationTone(69.9).bar).toBe('bg-green-600 dark:bg-green-500')
    expect(utilisationTone(0).text).toBe('text-green-600 dark:text-green-400')
    expect(utilisationTone(-5).bar).toBe('bg-green-600 dark:bg-green-500')
  })

  it('falls back to green for NaN rather than throwing or rendering nothing', () => {
    expect(utilisationTone(Number.NaN).bar).toBe('bg-green-600 dark:bg-green-500')
  })

  it('pairs every colour with a dark variant', () => {
    for (const percent of [0, 70, 90]) {
      const tone = utilisationTone(percent)
      expect(tone.text).toContain('dark:')
      expect(tone.bar).toContain('dark:')
    }
  })

  it('text and bar always agree on the tier', () => {
    for (const percent of [0, 50, 69.99, 70, 85, 89.99, 90, 100]) {
      const tone = utilisationTone(percent)
      // 'text-red-600 …' → 'red', 'bg-red-600 …' → 'red'
      expect(tone.text.split('-')[1]).toBe(tone.bar.split('-')[1])
    }
  })
})

describe('utilisationToneRgb', () => {
  it('uses the same thresholds as the class-based scale', () => {
    expect(utilisationToneRgb(90)).toEqual([239, 68, 68])
    expect(utilisationToneRgb(70)).toEqual([249, 115, 22])
    expect(utilisationToneRgb(69.9)).toEqual([34, 197, 94])
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

describe('getCreditTypeLabelKey', () => {
  it('maps every stored credit_type to an existing label key', () => {
    expect(getCreditTypeLabelKey('term_loan')).toBe('banks.credit_form.term_loan')
    expect(getCreditTypeLabelKey('construction_loan')).toBe('banks.credit_form.construction_loan')
    expect(getCreditTypeLabelKey('bridge_loan')).toBe('banks.credit_form.bridge_loan')
    expect(getCreditTypeLabelKey('equity')).toBe('funding.equity')
  })

  it('labels a line of credit by seniority, senior when unknown', () => {
    expect(getCreditTypeLabelKey('line_of_credit', 'junior')).toBe('banks.credit_form.loc_junior')
    expect(getCreditTypeLabelKey('line_of_credit', 'senior')).toBe('banks.credit_form.loc_senior')
    expect(getCreditTypeLabelKey('line_of_credit', null)).toBe('banks.credit_form.loc_senior')
  })

  it('returns null for anything else', () => {
    expect(getCreditTypeLabelKey('N/A')).toBeNull()
    expect(getCreditTypeLabelKey(undefined)).toBeNull()
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

  it('passes the stored repayment type through, for the renderer to translate', () => {
    const result = calculatePaymentSchedule(baseParams)
    expect(result!.principalFrequency).toBe('monthly')
    expect(result!.interestFrequency).toBe('monthly')

    const quarterly = calculatePaymentSchedule({
      ...baseParams,
      principal_repayment_type: 'quarterly',
    })
    expect(quarterly!.principalFrequency).toBe('quarterly')
  })
})
