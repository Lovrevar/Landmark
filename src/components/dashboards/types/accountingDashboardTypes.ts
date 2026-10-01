export interface VATStats {
  totalVATCollected: number
  totalVATPaid: number
  netVAT: number
  currentMonthVATCollected: number
  currentMonthVATPaid: number
}

export interface CashFlowStats {
  totalIncoming: number
  totalOutgoing: number
  netCashFlow: number
  currentMonthIncoming: number
  currentMonthOutgoing: number
  previousMonthIncoming: number
  previousMonthOutgoing: number
}

export interface TopCompany {
  id: string
  name: string
  totalIncoming: number
  totalOutgoing: number
  netBalance: number
  invoiceCount: number
}

export interface MonthlyData {
  /**
   * The month's first day as `'YYYY-MM-DD'`. It was a rendered `'MMM yyyy'` label until the
   * i18n sweep — an English month on a Croatian dashboard; `AccountingMonthlyTrendsSection`
   * formats it with `formatMonthYear`.
   */
  month: string
  incoming: number
  outgoing: number
}

export interface MonthlyBudget {
  budget_amount: number
  month: number
  year: number
}
