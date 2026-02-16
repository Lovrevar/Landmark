export interface DebtSummary {
  supplier_id: string
  supplier_name: string
  supplier_type: 'subcontractor' | 'retail_supplier' | 'office_supplier' | 'mixed'
  total_unpaid: number
  total_paid: number
  invoice_count: number
}
