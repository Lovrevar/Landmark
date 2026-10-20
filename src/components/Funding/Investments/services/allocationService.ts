import { supabase } from '../../../../lib/supabase'

export interface AllocationInvoice {
  /**
   * `payment`: a payment made from the allocation. `drawdown`: an `OUTGOING_BANK` invoice booked
   * against it, which adds its whole amount to `used_amount` the moment it is entered
   * (`update_credit_allocation_used_amount_from_invoice`) — no payment row involved.
   */
  kind: 'payment' | 'drawdown'
  /** Unique per row: the payment id, or the invoice id for a drawdown. */
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

type RawDrawdownRow = {
  id: string
  invoice_number: string | null
  issue_date: string
  total_amount: number | null
  paid_amount: number | null
  status: string | null
  description: string | null
}

/**
 * Everything that makes up an allocation's `used_amount`: payments made from it, and the drawdown
 * invoices booked against it.
 *
 * It listed the payments only, so an allocation whose money had been drawn down showed a used
 * amount with nothing under it to explain the figure (FUND-12).
 */
export const fetchAllocationInvoices = async (allocationId: string): Promise<AllocationInvoice[]> => {
  const [{ data, error }, { data: drawdownData, error: drawdownError }] = await Promise.all([
    supabase
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
      .order('payment_date', { ascending: false }),
    supabase
      .from('accounting_invoices')
      .select('id, invoice_number, issue_date, total_amount, paid_amount, status, description')
      .eq('invoice_type', 'OUTGOING_BANK')
      .eq('credit_allocation_id', allocationId),
  ])

  if (error) throw error
  if (drawdownError) throw drawdownError

  const payments: AllocationInvoice[] = (data as unknown as RawPaymentRow[] || []).map((p: RawPaymentRow) => ({
    kind: 'payment',
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

  const drawdowns: AllocationInvoice[] = ((drawdownData || []) as RawDrawdownRow[]).map(invoice => ({
    kind: 'drawdown',
    payment_id: invoice.id,
    payment_date: invoice.issue_date,
    // The whole invoice counts as used, paid or not.
    payment_amount: Number(invoice.total_amount) || 0,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number ?? '-',
    total_amount: Number(invoice.total_amount) || 0,
    paid_amount: Number(invoice.paid_amount) || 0,
    status: invoice.status ?? 'UNKNOWN',
    description: invoice.description,
    supplier_name: null,
  }))

  // Newest first across both; ISO dates sort as text.
  return [...payments, ...drawdowns].sort((x, y) => (y.payment_date || '').localeCompare(x.payment_date || ''))
}
