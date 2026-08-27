import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type { CreditFormData, CompanyBankAccount } from '../types'

export async function fetchCompanyBankAccounts(companyId: string): Promise<CompanyBankAccount[]> {
  const { data, error } = await supabase
    .from('company_bank_accounts')
    .select(`id, company_id, bank_name, account_number, current_balance`)
    .eq('company_id', companyId)

  if (error) throw error
  return data || []
}

export async function createCredit(
  newCredit: CreditFormData,
  computed: { credit_type: string; credit_seniority: string; monthly_payment: number },
): Promise<void> {
  const { error } = await supabase
    .from('bank_credits')
    .insert({
      ...newCredit,
      company_id: newCredit.company_id || null,
      project_id: newCredit.project_id || null,
      start_date: newCredit.start_date || null,
      maturity_date: newCredit.maturity_date || null,
      usage_expiration_date: newCredit.usage_expiration_date || null,
      disbursed_to_bank_account_id:
        newCredit.disbursed_to_account && newCredit.disbursed_to_bank_account_id
          ? newCredit.disbursed_to_bank_account_id
          : null,
      credit_type: computed.credit_type,
      credit_seniority: computed.credit_seniority,
      outstanding_balance: 0,
      monthly_payment: computed.monthly_payment,
      principal_repayment_type: newCredit.principal_repayment_type,
      interest_repayment_type: newCredit.interest_repayment_type,
    })

  if (error) throw error

  logActivity({
    action: 'bank_credit.create',
    entity: 'bank_credit',
    metadata: { severity: 'high', entity_name: newCredit.credit_name, amount: newCredit.amount },
  })
}

export async function updateCredit(
  creditId: string,
  newCredit: CreditFormData,
  computed: { credit_type: string; credit_seniority: string; monthly_payment: number },
): Promise<void> {
  const { error } = await supabase
    .from('bank_credits')
    .update({
      bank_id: newCredit.bank_id,
      company_id: newCredit.company_id || null,
      project_id: newCredit.project_id || null,
      credit_name: newCredit.credit_name,
      credit_type: computed.credit_type,
      credit_seniority: computed.credit_seniority,
      amount: newCredit.amount,
      interest_rate: newCredit.interest_rate,
      start_date: newCredit.start_date,
      maturity_date: newCredit.maturity_date,
      outstanding_balance: newCredit.outstanding_balance,
      monthly_payment: computed.monthly_payment,
      purpose: newCredit.purpose,
      usage_expiration_date: newCredit.usage_expiration_date || null,
      grace_period: newCredit.grace_period,
      repayment_type: newCredit.repayment_type,
      principal_repayment_type: newCredit.principal_repayment_type,
      interest_repayment_type: newCredit.interest_repayment_type,
      disbursed_to_account: newCredit.disbursed_to_account || false,
      disbursed_to_bank_account_id:
        newCredit.disbursed_to_account && newCredit.disbursed_to_bank_account_id
          ? newCredit.disbursed_to_bank_account_id
          : null,
    })
    .eq('id', creditId)

  if (error) throw error

  logActivity({
    action: 'bank_credit.update',
    entity: 'bank_credit',
    entityId: creditId,
    metadata: { severity: 'high', entity_name: newCredit.credit_name },
  })
}

/**
 * How many invoices still point at these credit facilities.
 *
 * `accounting_invoices.bank_credit_id` is the only ON DELETE RESTRICT reference to
 * `bank_credits`, so this count is exactly what blocks a delete.
 */
export async function countInvoicesForCredits(creditIds: string[]): Promise<number> {
  if (creditIds.length === 0) return 0

  const { count, error } = await supabase
    .from('accounting_invoices')
    .select('id', { count: 'exact', head: true })
    .in('bank_credit_id', creditIds)

  if (error) throw error
  return count ?? 0
}

/**
 * Unlinks invoices from these credit facilities so the credit rows can be deleted.
 * The invoices themselves are kept — only `bank_credit_id` is cleared.
 *
 * Must run before the delete: the update fires `recalculate_bank_credit_fields()` on the
 * OLD credit id, which is harmless while the credit still exists but has nothing to
 * recalculate once it is gone.
 */
export async function detachInvoicesFromCredits(creditIds: string[]): Promise<number> {
  if (creditIds.length === 0) return 0

  const { data, error } = await supabase
    .from('accounting_invoices')
    .update({ bank_credit_id: null })
    .in('bank_credit_id', creditIds)
    .select('id')

  if (error) throw error

  const detached = data?.length ?? 0
  if (detached > 0) {
    logActivity({
      action: 'invoice.bulk_detach_credit',
      entity: 'invoice',
      metadata: { severity: 'high', count: detached, credit_ids: creditIds },
    })
  }

  return detached
}

export async function deleteCredit(creditId: string): Promise<void> {
  const detachedInvoices = await detachInvoicesFromCredits([creditId])

  const { error } = await supabase.from('bank_credits').delete().eq('id', creditId)
  if (error) throw error

  logActivity({
    action: 'bank_credit.delete',
    entity: 'bank_credit',
    entityId: creditId,
    metadata: { severity: 'high', detached_invoices: detachedInvoices },
  })
}
