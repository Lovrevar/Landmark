import { supabase } from '../../../../lib/supabase'

export const fetchWirePayments = async (contractId: string) => {
  const { data, error } = await supabase
    .from('accounting_payments')
    .select(`
      *,
      invoice:accounting_invoices!inner(
        id,
        invoice_number,
        invoice_type,
        invoice_category,
        supplier_id,
        contract_id,
        project_id,
        total_amount,
        status
      )
    `)
    .eq('invoice.contract_id', contractId)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return data || []
}
