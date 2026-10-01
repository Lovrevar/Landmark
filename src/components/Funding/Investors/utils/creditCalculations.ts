import type { EquityFormData } from '../types'
import { parseLocalDate } from '../../../../utils/dateOnly'

export function getPaymentFrequency(type: string): number {
  switch (type) {
    case 'monthly':   return 12
    case 'quarterly': return 4
    case 'biyearly':  return 2
    case 'yearly':    return 1
    default:          return 12
  }
}

function getMaturityYears(startDate: string, maturityDate: string | null): number {
  if (!maturityDate || !startDate) return 10
  const start    = new Date(startDate)
  const maturity = new Date(maturityDate)
  return (maturity.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
}

/**
 * What the equity form's two preview boxes show: either a number, or a reason there isn't one.
 *
 * Both used to return the reason as an English sentence ("Enter amount, dates, and IRR to
 * calculate"), which a Croatian user read verbatim. These are pure functions with no translator,
 * so they report the state and `EquityFormModal` supplies the words.
 */
export type EquityPreview =
  | { status: 'ok'; value: string }
  | { status: 'incomplete' }
  | { status: 'invalid_range' }

export function calculateEquityCashflow(equity: Pick<EquityFormData, 'amount' | 'expected_return' | 'grace_period' | 'investment_date' | 'maturity_date' | 'payment_schedule'>): EquityPreview {
  const { amount, expected_return, grace_period, investment_date, maturity_date, payment_schedule } = equity
  if (!amount || !investment_date || !maturity_date || !expected_return) {
    return { status: 'incomplete' }
  }
  const principal        = amount
  const annualRate       = expected_return / 100
  const gracePeriodYears = grace_period / 12
  const totalYears       = getMaturityYears(investment_date, maturity_date)
  if (totalYears <= 0) return { status: 'invalid_range' }
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
  return { status: 'ok', value: payment.toLocaleString('hr-HR', { maximumFractionDigits: 0 }) }
}

export function calculateMoneyMultiple(equity: Pick<EquityFormData, 'amount' | 'expected_return' | 'investment_date' | 'maturity_date'>): EquityPreview {
  const { amount, expected_return, investment_date, maturity_date } = equity
  if (!amount || !investment_date || !maturity_date || !expected_return) {
    return { status: 'incomplete' }
  }
  const years = getMaturityYears(investment_date, maturity_date)
  if (years <= 0) return { status: 'invalid_range' }
  const annualRate    = expected_return / 100
  const totalReturn   = amount * Math.pow(1 + annualRate, years)
  const moneyMultiple = totalReturn / amount
  return { status: 'ok', value: `${moneyMultiple.toFixed(2)}x (${(moneyMultiple * 100).toFixed(0)}%)` }
}

export function parseCreditTypeAndSeniority(combined: string): { creditType: string; seniority: string } {
  const parts    = combined.split('_')
  const seniority    = parts[parts.length - 1]
  const creditType   = parts.slice(0, -1).join('_')
  return { creditType, seniority }
}

/**
 * An investor's credit risk from its utilisation: **> 80 High, > 60 Medium, else Low**.
 *
 * The bands are deliberately looser than `utilisationTone`'s ≥ 90 / ≥ 70 — this reads a whole
 * investor relationship, that one reads a single facility's bar. Only the wording changed with
 * the i18n sweep: `level` is the same value `RISK_LEVEL` in `src/utils/statusDisplay.ts` maps,
 * so the investor modal now says "Visok" where every other screen does.
 */
export function getCreditRiskLevel(utilization: number): { level: 'Low' | 'Medium' | 'High'; className: string } {
  if (utilization > 80) return { level: 'High',   className: 'text-red-600'    }
  if (utilization > 60) return { level: 'Medium', className: 'text-orange-600' }
  return                       { level: 'Low',    className: 'text-green-600'  }
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
  /**
   * The stored repayment type (`monthly` / `quarterly` / `biyearly` / `yearly`), not a label.
   * It used to be the English noun ("month", "6 months"), which `banks.credit_form.every_frequency`
   * interpolated into "Svakih month" — Croatian needs a whole phrase per frequency, so
   * `PaymentSchedulePreview` picks one.
   */
  principalFrequency: string
  interestFrequency: string
  /** Interest of the first and the last interest payment: it falls as principal is repaid. */
  firstInterestPayment: number
  lastInterestPayment: number
  totalInterest: number
  /**
   * Monthly-equivalent debt service when principal repayment starts — the largest it gets.
   * Stored as `bank_credits.monthly_payment` and summed as "monthly debt service" on the
   * Director dashboard and the general report.
   */
  monthlyDebtService: number
}

const STEP_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, biyearly: 6, yearly: 12 }

/** Months between two payments of the given frequency (monthly when unknown). */
const stepMonths = (frequency: string): number => STEP_MONTHS[frequency] ?? 1

/** Whole calendar months from `from` to `to` (a month counts once its day-of-month is reached). */
export function wholeMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return months
}

/**
 * The company's repayment model (decided 2026-10-01, DEFECT_BACKLOG FUND-5): **equal principal
 * instalments** at the principal frequency, starting after the grace period, and **interest on
 * the outstanding balance** at the interest frequency, charged from the start date — the grace
 * period defers principal, not interest. Instalments therefore fall over time.
 *
 * Simulated month by month: interest accrues on the balance at the start of each month and is
 * paid at every interest date; principal is repaid at every principal date, the last one clearing
 * whatever is left. Null without a start date, maturity date and amount, or when the grace period
 * reaches the maturity date.
 */
export function calculatePaymentSchedule(params: PaymentScheduleParams): PaymentScheduleResult | null {
  if (!params.start_date || !params.maturity_date || !params.amount) return null

  const startDate = parseLocalDate(params.start_date)
  const endDate = parseLocalDate(params.maturity_date)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  const graceMonths = Math.max(0, params.grace_period || 0)

  const paymentStartDate = new Date(startDate)
  paymentStartDate.setMonth(paymentStartDate.getMonth() + graceMonths)
  if (paymentStartDate >= endDate) return null

  const totalMonths = Math.max(1, wholeMonthsBetween(startDate, endDate))
  const principalMonths = Math.max(1, totalMonths - graceMonths)
  const principalStep = stepMonths(params.principal_repayment_type)
  const interestStep = stepMonths(params.interest_repayment_type)

  const totalPrincipalPayments = Math.max(1, Math.ceil(principalMonths / principalStep))
  const principalPerPayment = params.amount / totalPrincipalPayments
  const monthlyRate = (params.interest_rate || 0) / 100 / 12

  let balance = params.amount
  let accrued = 0
  let principalPaid = 0
  const interestPayments: number[] = []
  for (let month = 1; month <= totalMonths; month++) {
    accrued += balance * monthlyRate
    const repaymentMonth = month - graceMonths
    const isLastMonth = month === totalMonths
    if (repaymentMonth >= 1 && (repaymentMonth % principalStep === 0 || isLastMonth) && principalPaid < totalPrincipalPayments) {
      principalPaid += 1
      balance = principalPaid === totalPrincipalPayments || isLastMonth ? 0 : balance - principalPerPayment
    }
    if (month % interestStep === 0 || isLastMonth) {
      interestPayments.push(accrued)
      accrued = 0
    }
  }

  const firstInterestPayment = interestPayments[0] ?? 0
  return {
    principalPerPayment,
    interestPerPayment: firstInterestPayment,
    firstInterestPayment,
    lastInterestPayment: interestPayments[interestPayments.length - 1] ?? 0,
    totalInterest: interestPayments.reduce((sum, x) => sum + x, 0),
    totalPrincipalPayments,
    totalInterestPayments: interestPayments.length,
    paymentStartDate,
    principalFrequency: params.principal_repayment_type,
    interestFrequency: params.interest_repayment_type,
    monthlyDebtService: principalPerPayment / principalStep + params.amount * monthlyRate,
  }
}

/**
 * `bank_credits.monthly_payment`: the monthly-equivalent debt service at the start of principal
 * repayment under the repayment model above. 0 without a maturity date — there is no schedule to
 * derive it from (it used to assume ten years).
 */
export function calculateMonthlyDebtService(params: Omit<PaymentScheduleParams, 'maturity_date'> & { maturity_date: string | null }): number {
  if (!params.maturity_date) return 0
  return calculatePaymentSchedule({ ...params, maturity_date: params.maturity_date })?.monthlyDebtService ?? 0
}
