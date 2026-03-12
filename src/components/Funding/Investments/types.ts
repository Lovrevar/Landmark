export interface BankCredit {
  id: string
  bank_id: string
  project_id: string | null
  company_id: string | null
  credit_name: string
  credit_type: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string
  usage_expiration_date: string | null
  status: string
  purpose: string
  disbursed_to_account?: boolean
  disbursed_to_bank_account_id?: string
  bank?: { id: string; name: string }
  project?: { id: string; name: string }
  company?: { id: string; name: string }
}

export interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  created_at: string
  allocation_type: 'project' | 'opex' | 'refinancing'
  refinancing_entity_type?: 'company' | 'bank' | null
  refinancing_entity_id?: string | null
  project?: { id: string; name: string }
  refinancing_company?: { id: string; name: string }
  refinancing_bank?: { id: string; name: string }
}

export interface AllocationFormData {
  allocation_type: 'project' | 'opex' | 'refinancing'
  project_id: string
  refinancing_entity_type: 'company' | 'bank'
  refinancing_entity_id: string
  allocated_amount: number
  description: string
}

export interface RawPaymentEntry {
  payment_date: string
  amount: number
}

export interface RawCreditInvoice {
  id: string
  invoice_number: string
  issue_date: string
  total_amount: number
  status: string
  description?: string | null
  company?: { name?: string } | null
  bank?: { name?: string } | null
  payments?: RawPaymentEntry[]
  credit_allocation?: {
    allocation_type?: string
    project?: { name?: string } | null
  } | null
}

export interface CreditInvoiceRow {
  id: string
  invoice_number: string
  issue_date: string
  total_amount: number
  status: string
  company_name: string | null
  bank_name: string | null
  payment_date: string | null
  payment_amount: number | null
  description: string | null
  allocation_label?: string | null
}

export function mapCreditInvoice(inv: RawCreditInvoice): CreditInvoiceRow {
  const latestPayment = (inv.payments || []).sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  )[0]
  const totalPaid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

  let allocation_label: string | null = null
  if (inv.credit_allocation) {
    if (inv.credit_allocation.allocation_type === 'project') {
      allocation_label = inv.credit_allocation.project?.name ?? 'Projekt'
    } else if (inv.credit_allocation.allocation_type === 'opex') {
      allocation_label = 'OPEX'
    } else {
      allocation_label = 'Refinanciranje'
    }
  }

  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    issue_date: inv.issue_date,
    total_amount: inv.total_amount,
    status: inv.status,
    description: inv.description ?? null,
    company_name: inv.company?.name ?? null,
    bank_name: inv.bank?.name ?? null,
    payment_date: latestPayment?.payment_date ?? null,
    payment_amount: totalPaid || null,
    allocation_label,
  }
}
