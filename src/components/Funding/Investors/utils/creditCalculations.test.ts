import { describe, it, expect } from 'vitest'
import {
  getPaymentFrequency,
  calculateMonthlyDebtService,
  wholeMonthsBetween,
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

describe('calculateMonthlyDebtService', () => {
  const baseParams = {
    amount: 120_000,
    interest_rate: 6,
    grace_period: 0,
    start_date: '2026-01-01',
    maturity_date: '2036-01-01' as string | null, // 10 years
    principal_repayment_type: 'monthly',
    interest_repayment_type: 'monthly',
  }

  it('is principal per month plus a month of interest on the full amount', () => {
    // 120 monthly principal payments of 1000, plus 120000 × 6% / 12 = 600 of interest.
    expect(calculateMonthlyDebtService(baseParams)).toBeCloseTo(1600, 6)
  })

  it('spreads a yearly principal instalment over its twelve months', () => {
    // 10 yearly payments of 12000 → 1000 a month, plus 600 of interest.
    expect(calculateMonthlyDebtService({ ...baseParams, principal_repayment_type: 'yearly' })).toBeCloseTo(1600, 6)
  })

  it('is just the principal at 0% interest', () => {
    expect(calculateMonthlyDebtService({ ...baseParams, interest_rate: 0 })).toBeCloseTo(1000, 6)
  })

  it('rises with a grace period: the same principal over fewer months', () => {
    // 12 months of grace → 108 principal payments of 1111.11.
    expect(calculateMonthlyDebtService({ ...baseParams, grace_period: 12 })).toBeCloseTo(120_000 / 108 + 600, 6)
  })

  it('is 0 without a maturity date — there is no schedule to derive it from', () => {
    expect(calculateMonthlyDebtService({ ...baseParams, maturity_date: null })).toBe(0)
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

describe('wholeMonthsBetween', () => {
  it('counts a month once its day is reached', () => {
    expect(wholeMonthsBetween(new Date(2026, 0, 1), new Date(2036, 0, 1))).toBe(120)
    expect(wholeMonthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 14))).toBe(2)
    expect(wholeMonthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 15))).toBe(3)
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

  it('a clean 10-year loan has 120 monthly principal payments of 1000', () => {
    // The previous year-fraction arithmetic gave 119 (Math.floor(9.9986 × 12)).
    const result = calculatePaymentSchedule(baseParams)!
    expect(result.totalPrincipalPayments).toBe(120)
    expect(result.principalPerPayment).toBeCloseTo(1000, 6)
  })

  it('charges interest on the outstanding balance, so it falls to almost nothing', () => {
    const result = calculatePaymentSchedule(baseParams)!
    expect(result.firstInterestPayment).toBeCloseTo(600, 6)          // 120000 × 0.5%
    expect(result.lastInterestPayment).toBeCloseTo(5, 6)             // 1000 × 0.5%
    expect(result.interestPerPayment).toBe(result.firstInterestPayment)
    // Σ over balances 120000, 119000, … 1000 = 0.005 × 1000 × (120·121/2) = 36300.
    expect(result.totalInterest).toBeCloseTo(36_300, 4)
    expect(result.totalInterestPayments).toBe(120)
  })

  it('a grace period defers principal but not interest', () => {
    const result = calculatePaymentSchedule({ ...baseParams, grace_period: 12 })!
    expect(result.paymentStartDate.getFullYear()).toBe(2027)
    expect(result.paymentStartDate.getMonth()).toBe(0)
    expect(result.totalPrincipalPayments).toBe(108)
    expect(result.totalInterestPayments).toBe(120)          // interest is paid through the grace year
    expect(result.firstInterestPayment).toBeCloseTo(600, 6)
  })

  it('quarterly interest collects three months of accrual', () => {
    const result = calculatePaymentSchedule({ ...baseParams, interest_repayment_type: 'quarterly' })!
    expect(result.totalInterestPayments).toBe(40)
    // Months 1–3: balances 120000, 119000, 118000 → (357000) × 0.5%.
    expect(result.firstInterestPayment).toBeCloseTo(1785, 6)
  })

  it('a term that is not a whole number of periods ends with a final payment that clears the rest', () => {
    // 10 months, quarterly principal → payments in months 3, 6, 9 and 10.
    const result = calculatePaymentSchedule({ ...baseParams, maturity_date: '2026-11-01', principal_repayment_type: 'quarterly' })!
    expect(result.totalPrincipalPayments).toBe(4)
    expect(result.principalPerPayment).toBeCloseTo(30_000, 6)
  })

  it('reports the monthly-equivalent debt service it stores', () => {
    expect(calculatePaymentSchedule(baseParams)!.monthlyDebtService).toBeCloseTo(1600, 6)
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
