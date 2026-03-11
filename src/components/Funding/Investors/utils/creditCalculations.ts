import type { CreditFormData, EquityFormData } from '../types'

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
  return payment.toLocaleString(undefined, { maximumFractionDigits: 0 })
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

export function getCreditTypeBadgeVariant(creditType: string): 'blue' | 'green' | 'orange' | 'gray' {
  switch (creditType) {
    case 'construction_loan': return 'blue'
    case 'term_loan':         return 'green'
    case 'bridge_loan':       return 'orange'
    default:                  return 'gray'
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
