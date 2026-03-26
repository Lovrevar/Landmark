import { supabase } from '../../../../lib/supabase'
import type { Contract } from '../../../../lib/supabase'
import { format } from 'date-fns'

export interface PaymentWithDetails {
  id: string
  amount: number
  payment_date: string
  created_at: string
  notes?: string
  company_bank_account_id?: string
  cesija_company_id?: string
  is_cesija?: boolean
  contract?: Contract
  subcontractor_name?: string
  project_name?: string
  phase_name?: string
  paid_by_company_name?: string
}

export interface PaymentStats {
  totalPayments: number
  totalAmount: number
  paymentsThisMonth: number
  amountThisMonth: number
}

type RawPayment = Record<string, unknown> & {
  id: string
  amount: string
  payment_date: string
  created_at: string
  description?: string
  company_bank_account_id?: string
  cesija_company_id?: string
  is_cesija?: boolean
  invoice?: { supplier_id?: string; project_id?: string; contract_id?: string } | null
  cesija_company?: { name: string } | null
  credit?: { company?: { name: string } } | null
  company_bank_account?: { company?: { name: string } } | null
}

type ContractWithPhase = {
  id: string
  contract_number: string
  subcontractor_id: string
  phase_id: string | null
  project_phases?: { id: string; phase_name: string } | null
}

export async function fetchSupervisionPayments(): Promise<PaymentWithDetails[]> {
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('accounting_payments')
    .select(`
      *,
      invoice:accounting_invoices(
        id, invoice_number, invoice_type, invoice_category,
        supplier_id, project_id, milestone_id, total_amount, status
      ),
      company_bank_account:company_bank_accounts!accounting_payments_company_bank_account_id_fkey(
        id, bank_name,
        company:accounting_companies(id, name)
      ),
      cesija_company:accounting_companies!accounting_payments_cesija_company_id_fkey(id, name),
      credit:bank_credits!accounting_payments_credit_id_fkey(
        id, credit_name,
        company:accounting_companies(id, name)
      )
    `)
    .eq('invoice.invoice_type', 'INCOMING_SUPPLIER')
    .eq('invoice.invoice_category', 'SUBCONTRACTOR')
    .not('invoice.project_id', 'is', null)
    .order('payment_date', { ascending: false })

  if (paymentsError) throw paymentsError

  const [subcontractorsRes, contractsRawRes, projectsRes] = await Promise.all([
    supabase.from('subcontractors').select('id, name'),
    supabase.from('contracts').select('id, contract_number, subcontractor_id, phase_id, project_phases(id, phase_name)'),
    supabase.from('projects').select('id, name'),
  ])

  const subcontractorsData = subcontractorsRes.data || []
  const contractsData = contractsRawRes.data as unknown as ContractWithPhase[] | null
  const projectsData = projectsRes.data || []

  return (paymentsData || []).map((payment: RawPayment) => {
    const invoice = payment.invoice
    if (!invoice) return null

    const subcontractor = subcontractorsData.find(s => s.id === invoice.supplier_id)
    const project = projectsData.find(p => p.id === invoice.project_id)

    let contract = contractsData?.find(c => c.id === invoice.contract_id)
    if (!contract) {
      contract = contractsData?.find(c => c.subcontractor_id === invoice.supplier_id)
    }

    const phaseName = contract?.project_phases?.phase_name || null

    let paidByCompanyName = '-'
    if (payment.is_cesija && payment.cesija_company) {
      paidByCompanyName = payment.cesija_company.name
    } else if (payment.credit?.company) {
      paidByCompanyName = payment.credit.company.name
    } else if (payment.company_bank_account?.company) {
      paidByCompanyName = payment.company_bank_account.company.name
    }

    return {
      id: payment.id,
      amount: parseFloat(payment.amount),
      payment_date: payment.payment_date,
      created_at: payment.created_at,
      notes: payment.description,
      company_bank_account_id: payment.company_bank_account_id,
      cesija_company_id: payment.cesija_company_id,
      is_cesija: payment.is_cesija,
      subcontractor_name: subcontractor?.name || 'Unknown',
      project_name: project?.name || 'No Project',
      phase_name: phaseName,
      contract: contract ? {
        id: contract.id,
        contract_number: contract.contract_number,
        subcontractor_id: contract.subcontractor_id,
        phase_id: contract.phase_id,
      } as Contract : undefined,
      paid_by_company_name: paidByCompanyName,
    }
  }).filter(Boolean) as PaymentWithDetails[]
}

export function calculatePaymentStats(payments: PaymentWithDetails[]): PaymentStats {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const paymentsThisMonth = payments.filter(p => new Date(p.created_at) >= firstDayOfMonth)
  return {
    totalPayments: payments.length,
    totalAmount,
    paymentsThisMonth: paymentsThisMonth.length,
    amountThisMonth: paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0),
  }
}

export function exportPaymentsCSV(payments: PaymentWithDetails[]): void {
  const headers = ['Date', 'Subcontractor', 'Project', 'Phase', 'Paid By', 'Amount', 'Notes']
  const rows = payments.map(p => [
    format(new Date(p.payment_date || p.created_at), 'yyyy-MM-dd'),
    p.subcontractor_name,
    p.project_name,
    p.phase_name || '',
    p.paid_by_company_name || '-',
    p.amount.toString(),
    p.notes || '',
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
}
