export interface DebtSummary {
  supplier_id: string
  supplier_name: string
  supplier_type: string
  total_unpaid: number
  total_paid: number
  invoice_count: number
}
