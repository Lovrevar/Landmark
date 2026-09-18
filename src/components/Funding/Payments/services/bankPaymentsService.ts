import { supabase, BankCreditPayment } from '../../../../lib/supabase'
import { paymentDirection, type PaymentDirection } from '../../../Cashflow/services/invoiceHelpers'

export interface BankPaymentWithDetails extends BankCreditPayment {
  bank_name?: string
  credit_type?: string
  credit_seniority?: string | null
  project_name?: string
  invoice_type: string
  /**
   * Money into the company (a drawdown, OUTGOING_BANK) or out of it (a repayment, INCOMING_BANK,
   * or credit fees, INCOMING_BANK_EXPENSES). Every row here used to render as the same green
   * "Bank" payment and sum into one total, so a €500k drawdown and its repayment read as €1M.
   */
  direction: PaymentDirection | null
}

export async function fetchBankPayments(): Promise<BankPaymentWithDetails[]> {
  const { data: bankPaymentsData, error: bankError } = await supabase
    .from('accounting_payments')
    .select(`
      *,
      invoice:accounting_invoices!inner(
        invoice_type,
        bank_credit_id,
        bank_credits(
          credit_type,
          credit_seniority,
          project_id,
          bank_id,
          banks(name)
        )
      )
    `)
    .not('invoice.bank_credit_id', 'is', null)
    .order('payment_date', { ascending: false })

  if (bankError) throw bankError

  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('id, name')

  if (projectsError) throw projectsError

  return (bankPaymentsData || []).map(payment => {
    const bankCredit = payment.invoice?.bank_credits
    const project = bankCredit?.project_id
      ? projectsData?.find((p: { id: string; name: string }) => p.id === bankCredit.project_id)
      : undefined

    return {
      ...payment,
      bank_name: bankCredit?.banks?.name || 'Unknown Bank',
      credit_type: bankCredit?.credit_type || 'N/A',
      credit_seniority: bankCredit?.credit_seniority ?? null,
      project_name: project?.name || 'No Project',
      invoice_type: payment.invoice?.invoice_type ?? '',
      direction: paymentDirection(payment.invoice?.invoice_type),
      created_at: payment.created_at,
      notes: payment.description,
    }
  })
}
