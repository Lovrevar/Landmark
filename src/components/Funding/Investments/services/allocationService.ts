import { supabase } from '../../../../lib/supabase'

export interface AllocationInvoice {
  payment_id: string
  payment_date: string
  payment_amount: number
  invoice_id: string
  invoice_number: string
  total_amount: number
  paid_amount: number
  status: string
  description: string | null
  supplier_name: string | null
}

type RawPaymentRow = {
  id: string
  payment_date: string
  amount: number
  invoice?: {
    id?: string
    invoice_number?: string
    total_amount?: number
    paid_amount?: number
    status?: string
    description?: string | null
    supplier?: { name?: string } | null
    office_supplier?: { name?: string } | null
    retail_supplier?: { name?: string } | null
  } | null
}

export const fetchAllocationInvoices = async (allocationId: string): Promise<AllocationInvoice[]> => {
  const { data, error } = await supabase
    .from('accounting_payments')
    .select(`
      id,
      payment_date,
      amount,
      invoice:accounting_invoices(
        id,
        invoice_number,
        total_amount,
        paid_amount,
        status,
        description,
        supplier:subcontractors(name),
        office_supplier:office_suppliers(name),
        retail_supplier:retail_suppliers(name)
      )
    `)
    .eq('credit_allocation_id', allocationId)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return (data as unknown as RawPaymentRow[] || []).map((p: RawPaymentRow) => ({
    payment_id: p.id,
    payment_date: p.payment_date,
    payment_amount: p.amount,
    invoice_id: p.invoice?.id ?? '',
    invoice_number: p.invoice?.invoice_number ?? '-',
    total_amount: p.invoice?.total_amount ?? 0,
    paid_amount: p.invoice?.paid_amount ?? 0,
    status: p.invoice?.status ?? 'UNKNOWN',
    description: p.invoice?.description ?? null,
    supplier_name:
      p.invoice?.supplier?.name ??
      p.invoice?.office_supplier?.name ??
      p.invoice?.retail_supplier?.name ??
      null,
  }))
}
