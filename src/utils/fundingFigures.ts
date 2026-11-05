/**
 * Funding figures from `bank_credits`, `credit_allocations` and `company_loans`: debt, equity,
 * D/E, the weighted interest rate, debt service, credit headroom, funders and loans. One
 * definition each, for the General report and the Director dashboard (REGRESSION_PREVENTION
 * Step 7).
 *
 * The definitions are the ones GEN-2 settled (September 2026, see `docs/REPORTS.md` → "General
 * report definitions"):
 *
 * - **Debt** is what is still owed on live, non-equity credits — not repaid, not defaulted. It
 *   used to be the face value of every credit, equity and repaid ones included.
 * - **Equity** is the equity facilities' amount. It used to be Σ credit allocations.
 * - **The average rate** is weighted by facility amount over live debt, so a small credit moves it
 *   less than a large one.
 *
 * `projectFunding` is the exception: it still computes a project's figures the pre-GEN-2 way,
 * because that is what the General report's project cards show (GEN-27).
 */

const num = (value: unknown): number => Number(value || 0)

/** A `bank_credits` row, narrowed to what these figures read. */
export interface CreditRow {
  id?: string
  bank_id?: string | null
  project_id?: string | null
  credit_type?: string | null
  status?: string | null
  amount?: number | string | null
  used_amount?: number | string | null
  outstanding_balance?: number | string | null
  interest_rate?: number | string | null
  monthly_payment?: number | string | null
}

/** Counts as debt: not an equity facility, and still live (not repaid or defaulted). */
export const isLiveDebt = (credit: CreditRow): boolean =>
  credit.credit_type !== 'equity' && credit.status !== 'paid' && credit.status !== 'defaulted'

export interface LiveDebtFigures {
  /** Σ `outstanding_balance` — the portfolio's debt. */
  outstanding: number
  /** Σ `amount`: the live debt facilities' size. */
  facilityAmount: number
  /** Σ `used_amount`. */
  used: number
  /** Interest rate weighted by facility amount; 0 with no live debt. */
  avgInterestRate: number
  /** Σ `monthly_payment`. */
  monthlyDebtService: number
}

/** The debt figures, over live debt only. */
export function liveDebtFigures(credits: readonly CreditRow[]): LiveDebtFigures {
  const live = credits.filter(isLiveDebt)
  const facilityAmount = live.reduce((sum, c) => sum + num(c.amount), 0)
  return {
    outstanding: live.reduce((sum, c) => sum + num(c.outstanding_balance), 0),
    facilityAmount,
    used: live.reduce((sum, c) => sum + num(c.used_amount), 0),
    avgInterestRate: facilityAmount > 0
      ? live.reduce((sum, c) => sum + num(c.interest_rate) * num(c.amount), 0) / facilityAmount
      : 0,
    monthlyDebtService: live.reduce((sum, c) => sum + num(c.monthly_payment), 0),
  }
}

/** Σ `amount` of the equity facilities. */
export const totalEquity = (credits: readonly CreditRow[]): number =>
  credits.filter(c => c.credit_type === 'equity').reduce((sum, c) => sum + num(c.amount), 0)

/** Debt over equity; 0 with no equity (GEN-32 asks whether it should be "—"). */
export const debtToEquity = (debt: number, equity: number): number => (equity > 0 ? debt / equity : 0)

export interface CreditLineTotals {
  count: number
  /** Σ `amount` of every credit, equity and repaid ones included. */
  total: number
  used: number
  /** Undrawn headroom: Σ (`amount` − `used_amount`), per credit, so an overdrawn one subtracts. */
  available: number
}

/** Every credit line, whatever its type or status. */
export function creditLineTotals(credits: readonly CreditRow[]): CreditLineTotals {
  return {
    count: credits.length,
    total: credits.reduce((sum, c) => sum + num(c.amount), 0),
    used: credits.reduce((sum, c) => sum + num(c.used_amount), 0),
    available: credits.reduce((sum, c) => sum + (num(c.amount) - num(c.used_amount)), 0),
  }
}

/** A `credit_allocations` row. */
export interface AllocationRow {
  credit_id?: string | null
  project_id?: string | null
  allocated_amount?: number | string | null
}

/** How many allocations there are and Σ `allocated_amount`. */
export const allocationTotals = (allocations: readonly AllocationRow[]): { count: number; allocated: number } => ({
  count: allocations.length,
  allocated: allocations.reduce((sum, a) => sum + num(a.allocated_amount), 0),
})

/** Distinct banks behind the credits that have at least one allocation. */
export function activeFunderCount(allocations: readonly AllocationRow[], credits: readonly CreditRow[]): number {
  const bankByCredit = new Map(credits.map(c => [c.id, c.bank_id]))
  return new Set(allocations.map(a => bankByCredit.get(a.credit_id ?? undefined)).filter(Boolean)).size
}

/**
 * A project's funding as the General report's project cards show it: equity is Σ the project's
 * allocations, whatever the credit's type, and debt the face value of every credit of the project,
 * equity and repaid ones included. Not the portfolio's definitions (GEN-27).
 */
export function projectFunding(
  projectId: string,
  allocations: readonly AllocationRow[],
  credits: readonly CreditRow[],
): { equity: number; debt: number } {
  return {
    equity: allocations.filter(a => a.project_id === projectId).reduce((sum, a) => sum + num(a.allocated_amount), 0),
    debt: credits.filter(c => c.project_id === projectId).reduce((sum, c) => sum + num(c.amount), 0),
  }
}

/** A `company_loans` row. */
export interface LoanRow {
  amount?: number | string | null
  current_balance?: number | string | null
}

/** Company-to-company loans: count, Σ lent, Σ still outstanding, and how many are outstanding. */
export const loanTotals = (loans: readonly LoanRow[]) => ({
  count: loans.length,
  amount: loans.reduce((sum, l) => sum + num(l.amount), 0),
  outstanding: loans.reduce((sum, l) => sum + num(l.current_balance), 0),
  active: loans.filter(l => num(l.current_balance) > 0).length,
})
