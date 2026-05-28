import { supabase, BankCreditPayment } from '../../../../lib/supabase'

export interface BankPaymentWithDetails extends BankCreditPayment {
  bank_name?: string
  credit_type?: string
  project_name?: string
  payment_type: 'bank'
}

export async function fetchBankPayments(): Promise<BankPaymentWithDetails[]> {
  const { data: bankPaymentsData, error: bankError } = await supabase
    .from('accounting_payments')
    .select(`
      *,
      invoice:accounting_invoices!inner(
        bank_credit_id,
        bank_credits(
          credit_type,
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
      project_name: project?.name || 'No Project',
      payment_type: 'bank' as const,
      created_at: payment.created_at,
      notes: payment.description,
    }
  })
}
