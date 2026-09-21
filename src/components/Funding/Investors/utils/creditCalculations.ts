import type { EquityFormData } from '../types'

export function getPaymentFrequency(type: string): number {
  switch (type) {
    case 'monthly':   return 12
    case 'quarterly': return 4
    case 'biyearly':  return 2
    case 'yearly':    return 1
    default:          return 12
  }
}

function freqLabel(type: string): string {
  return (({ monthly: 'month', quarterly: 'quarter', biyearly: '6 months', yearly: 'year' } as Record<string, string>)[type] ?? type)
}

function getMaturityYears(startDate: string, maturityDate: string | null): number {
  if (!maturityDate || !startDate) return 10
  const start    = new Date(startDate)
  const maturity = new Date(maturityDate)
  return (maturity.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
}

export function calculateAnnuityPayment(params: {
  amount: number
  interest_rate: number
  grace_period: number   // in months
  start_date: string
  maturity_date: string | null
  repayment_type: 'monthly' | 'yearly'
}): number {
  const principal        = params.amount
  const annualRate       = params.interest_rate / 100
  const gracePeriodYears = params.grace_period / 12   // grace_period is in months
  const maturityYears    = getMaturityYears(params.start_date, params.maturity_date)
  const repaymentYears   = Math.max(0.1, maturityYears - gracePeriodYears)

  if (annualRate === 0) {
    return params.repayment_type === 'yearly'
      ? principal / repaymentYears
      : principal / (repaymentYears * 12)
  }

  if (params.repayment_type === 'yearly') {
    const r = annualRate
    return (principal * r * Math.pow(1 + r, repaymentYears)) / (Math.pow(1 + r, repaymentYears) - 1)
  } else {
    const r = annualRate / 12
    const n = repaymentYears * 12
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  }
}

export function calculateEquityCashflow(equity: Pick<EquityFormData, 'amount' | 'expected_return' | 'grace_period' | 'investment_date' | 'maturity_date' | 'payment_schedule'>): string {
  const { amount, expected_return, grace_period, investment_date, maturity_date, payment_schedule } = equity
  if (!amount || !investment_date || !maturity_date || !expected_return) {
    return 'Enter amount, dates, and IRR to calculate'
  }
  const principal        = amount
  const annualRate       = expected_return / 100
  const gracePeriodYears = grace_period / 12
  const totalYears       = getMaturityYears(investment_date, maturity_date)
  if (totalYears <= 0) return 'Invalid date range'
  const repaymentYears = Math.max(0.1, totalYears - gracePeriodYears)

  let payment: number
  if (annualRate === 0) {
    payment = payment_schedule === 'yearly'
      ? principal / repaymentYears
      : principal / (repaymentYears * 12)
  } else if (payment_schedule === 'yearly') {
    const r = annualRate
    payment = (principal * r * Math.pow(1 + r, repaymentYears)) / (Math.pow(1 + r, repaymentYears) - 1)
  } else {
    const r = annualRate / 12
    const n = repaymentYears * 12
    payment = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  }
  // hr-HR, not the viewer's browser locale: an en-US machine rendered "10,436" for €10.436.
  return payment.toLocaleString('hr-HR', { maximumFractionDigits: 0 })
}

export function calculateMoneyMultiple(equity: Pick<EquityFormData, 'amount' | 'expected_return' | 'investment_date' | 'maturity_date'>): string {
  const { amount, expected_return, investment_date, maturity_date } = equity
  if (!amount || !investment_date || !maturity_date || !expected_return) {
    return 'Enter amount, dates, and IRR to calculate'
  }
  const years = getMaturityYears(investment_date, maturity_date)
  if (years <= 0) return 'Invalid date range'
  const annualRate    = expected_return / 100
  const totalReturn   = amount * Math.pow(1 + annualRate, years)
  const moneyMultiple = totalReturn / amount
  return `${moneyMultiple.toFixed(2)}x (${(moneyMultiple * 100).toFixed(0)}%)`
}

export function parseCreditTypeAndSeniority(combined: string): { creditType: string; seniority: string } {
  const parts    = combined.split('_')
  const seniority    = parts[parts.length - 1]
  const creditType   = parts.slice(0, -1).join('_')
  return { creditType, seniority }
}

export function getCreditRiskLevel(utilization: number): { label: string; className: string } {
  if (utilization > 80) return { label: 'High',   className: 'text-red-600'    }
  if (utilization > 60) return { label: 'Medium', className: 'text-orange-600' }
  return                       { label: 'Low',    className: 'text-green-600'  }
}

export interface UtilisationTone {
  /** Text colour for the percentage itself. */
  text: string
  /** Fill colour for the progress bar. */
  bar: string
}

/**
 * The one utilisation colour scale: **≥ 90 red, ≥ 70 orange, else green**.
 *
 * Five screens each had their own thresholds (> 80/> 60, ≥ 90/≥ 70 over blue, ≥ 80/≥ 50 …),
 * and inside `InvestmentProjectModal` the percentage and its bar disagreed with each other —
 * at 92% the figure was orange while the bar beside it was red. Everything that renders a
 * credit/funding utilisation now reads its classes from here: `InvestorCard`,
 * `InvestmentCreditsTable`, `InvestmentProjectModal`, `CompanyDetailsModal`, and
 * `investmentReportPdf` through `utilisationToneRgb`.
 *
 * Not a risk *label* — `getCreditRiskLevel` keeps its own (looser) bands and its English
 * labels, which belong to the i18n sweep.
 */
export function utilisationTone(percent: number): UtilisationTone {
  if (percent >= 90) return { text: 'text-red-600 dark:text-red-400',    bar: 'bg-red-600 dark:bg-red-500'    }
  if (percent >= 70) return { text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-600 dark:bg-orange-500' }
  return                     { text: 'text-green-600 dark:text-green-400',  bar: 'bg-green-600 dark:bg-green-500'  }
}

/** The same scale as RGB, for jsPDF (which cannot read Tailwind classes). */
export function utilisationToneRgb(percent: number): [number, number, number] {
  if (percent >= 90) return [239, 68, 68]   // red-500
  if (percent >= 70) return [249, 115, 22]  // orange-500
  return [34, 197, 94]                      // green-500
}

export function getCreditTypeBadgeVariant(creditType: string): 'blue' | 'green' | 'orange' | 'gray' {
  switch (creditType) {
    case 'construction_loan': return 'blue'
    case 'term_loan':         return 'green'
    case 'bridge_loan':       return 'orange'
    default:                  return 'gray'
  }
}

/**
 * i18n key for a stored `bank_credits.credit_type` (term_loan | line_of_credit | construction_loan
 * | bridge_loan | equity), reusing the credit form's option labels. A line of credit's label
 * carries its seniority, as it does in the form. Null for anything else — callers fall back to
 * the raw value with every underscore replaced (`replace('_', ' ')` only replaced the first, so
 * `line_of_credit` rendered as "LINE OF_CREDIT").
 */
export function getCreditTypeLabelKey(creditType: string | null | undefined, seniority?: string | null): string | null {
  switch (creditType) {
    case 'term_loan':         return 'banks.credit_form.term_loan'
    case 'construction_loan': return 'banks.credit_form.construction_loan'
    case 'bridge_loan':       return 'banks.credit_form.bridge_loan'
    case 'line_of_credit':    return seniority === 'junior' ? 'banks.credit_form.loc_junior' : 'banks.credit_form.loc_senior'
    case 'equity':            return 'funding.equity'
    default:                  return null
  }
}

export interface PaymentScheduleParams {
  start_date: string
  maturity_date: string
  amount: number
  grace_period: number  // months
  interest_rate: number
  principal_repayment_type: string
  interest_repayment_type: string
}

export interface PaymentScheduleResult {
  principalPerPayment: number
  interestPerPayment: number
  totalPrincipalPayments: number
  totalInterestPayments: number
  paymentStartDate: Date
  principalFrequency: string
  interestFrequency: string
}

export function calculatePaymentSchedule(params: PaymentScheduleParams): PaymentScheduleResult | null {
  if (!params.start_date || !params.maturity_date || !params.amount) return null

  const startDate        = new Date(params.start_date)
  const endDate          = new Date(params.maturity_date)
  const gracePeriodMonths = params.grace_period || 0

  const paymentStartDate = new Date(startDate)
  paymentStartDate.setMonth(paymentStartDate.getMonth() + gracePeriodMonths)
  if (paymentStartDate >= endDate) return null

  const totalYears = (endDate.getTime() - paymentStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

  const principalFreq = getPaymentFrequency(params.principal_repayment_type)
  const interestFreq  = getPaymentFrequency(params.interest_repayment_type)

  const totalPrincipalPayments = Math.max(1, Math.floor(totalYears * principalFreq))
  const totalInterestPayments  = Math.max(1, Math.floor(totalYears * interestFreq))

  const principalPerPayment = params.amount / totalPrincipalPayments
  const annualInterest      = params.amount * (params.interest_rate / 100)
  const interestPerPayment  = annualInterest / interestFreq

  return {
    principalPerPayment,
    interestPerPayment,
    totalPrincipalPayments,
    totalInterestPayments,
    paymentStartDate,
    principalFrequency: freqLabel(params.principal_repayment_type),
    interestFrequency:  freqLabel(params.interest_repayment_type),
  }
}
