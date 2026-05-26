import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type { BankWithCredits, Company } from '../types'

export interface BankFormPayload {
  name: string
  contact_person: string
  contact_email: string
  contact_phone: string
}

export interface FundingBanksData {
  banks: BankWithCredits[]
  companies: Company[]
}

export async function fetchFundingBanksData(): Promise<FundingBanksData> {
  const { data: banksData, error: banksError } = await supabase
    .from('banks')
    .select('*')
    .order('name')
  if (banksError) throw banksError

  const { data: companiesData, error: companiesError } = await supabase
    .from('accounting_companies')
    .select('id, name, oib')
    .order('name')
  if (companiesError) throw companiesError

  const { data: creditsData, error: creditsError } = await supabase
    .from('bank_credits')
    .select(`
      *,
      used_amount,
      repaid_amount,
      projects(name),
      accounting_companies(name)
    `)
    .order('start_date', { ascending: false })
  if (creditsError) throw creditsError

  const banksWithCredits = (banksData || []).map(bank => {
    const bankCredits = (creditsData || []).filter(credit => credit.bank_id === bank.id)
    const total_credits = bankCredits.length
    const active_credits = bankCredits.filter(credit => credit.status === 'active').length
    const credit_utilized = bankCredits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0)
    const outstanding_debt = bankCredits.reduce((sum, credit) => sum + Number(credit.outstanding_balance || 0), 0)
    const available_funds = bank.total_credit_limit - credit_utilized
    const total_used = bankCredits.reduce((sum, credit) => sum + Number(credit.used_amount || 0), 0)
    const credit_utilization = credit_utilized > 0
      ? (total_used / credit_utilized) * 100
      : 0

    return {
      ...bank,
      credit_utilized,
      outstanding_debt,
      available_funds,
      credits: bankCredits,
      total_credits,
      active_credits,
      credit_utilization
    }
  })

  return { banks: banksWithCredits as BankWithCredits[], companies: companiesData || [] }
}

export async function createBank(payload: BankFormPayload): Promise<void> {
  const { data: inserted, error } = await supabase.from('banks').insert(payload).select('id').maybeSingle()
  if (error) throw error

  logActivity({
    action: 'investor.create',
    entity: 'investor',
    entityId: inserted?.id ?? null,
    metadata: { severity: 'medium', entity_name: payload.name },
  })
}

export async function updateBank(bankId: string, payload: BankFormPayload): Promise<void> {
  const { error } = await supabase.from('banks').update(payload).eq('id', bankId)
  if (error) throw error

  logActivity({
    action: 'investor.update',
    entity: 'investor',
    entityId: bankId,
    metadata: { severity: 'medium', entity_name: payload.name },
  })
}

export async function deleteBank(bankId: string): Promise<void> {
  const { error } = await supabase.from('banks').delete().eq('id', bankId)
  if (error) throw error

  logActivity({
    action: 'investor.delete',
    entity: 'investor',
    entityId: bankId,
    metadata: { severity: 'high' },
  })
}
