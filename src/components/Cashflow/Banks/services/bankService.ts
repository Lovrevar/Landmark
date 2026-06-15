import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { BankWithCredits, BankCredit, Project, Company, NewCreditForm } from '../bankTypes'
import { calculateAnnuityPayment, calculatePaymentSchedule } from '../../../Funding/Investors/utils/creditCalculations'

export const fetchProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export const fetchCompanies = async (): Promise<Company[]> => {
  const { data, error } = await supabase
    .from('accounting_companies')
    .select('id, name, oib')
    .order('name')

  if (error) throw error
  return data || []
}

export const fetchBanksWithCredits = async (): Promise<BankWithCredits[]> => {
  const { data: banksData, error: banksError } = await supabase
    .from('banks')
    .select('*')
    .order('name')

  if (banksError) throw banksError
  if (!banksData || banksData.length === 0) return []

  const bankIds = banksData.map(b => b.id)
  const { data: creditsData, error: creditsError } = await supabase
    .from('bank_credits')
    .select(`
      *,
      used_amount,
      repaid_amount,
      projects(id, name),
      accounting_companies(name)
    `)
    .in('bank_id', bankIds)
    .order('start_date', { ascending: false })

  if (creditsError) throw creditsError

  const creditsByBank = new Map<string, BankCredit[]>()
  for (const credit of (creditsData || []) as BankCredit[]) {
    const bucket = creditsByBank.get(credit.bank_id)
    if (bucket) bucket.push(credit)
    else creditsByBank.set(credit.bank_id, [credit])
  }

  return banksData.map(bank => {
    const credits = creditsByBank.get(bank.id) || []
    const totalCreditLimit = credits.reduce((sum, c) => sum + c.amount, 0)
    const totalUsed = credits.reduce((sum, c) => sum + (c.used_amount || 0), 0)
    const totalRepaid = credits.reduce((sum, c) => sum + (c.repaid_amount || 0), 0)
    const totalOutstanding = credits.reduce((sum, c) => sum + c.outstanding_balance, 0)

    return {
      ...bank,
      total_credit_limit: totalCreditLimit,
      total_used: totalUsed,
      total_repaid: totalRepaid,
      total_outstanding: totalOutstanding,
      credits
    }
  })
}

// Delegates to the shared, unit-tested annuity formula (the persisted
// `monthly_payment`). Previously a hand-copied duplicate that drifted (it
// divided the grace period by 365 instead of 12).
export const calculateRateAmount = (credit: NewCreditForm): number => {
  return calculateAnnuityPayment({
    amount: credit.amount,
    interest_rate: credit.interest_rate,
    grace_period: credit.grace_period,
    start_date: credit.start_date,
    maturity_date: credit.maturity_date || null,
    repayment_type: credit.repayment_type,
  })
}

// Number of annuity payments over the repayment term — mirrors the internal
// `n` of calculateAnnuityPayment so annuity-derived totals stay consistent.
const annuityPaymentCount = (credit: NewCreditForm): number => {
  const maturityYears = credit.maturity_date && credit.start_date
    ? (new Date(credit.maturity_date).getTime() - new Date(credit.start_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 10
  const repaymentYears = Math.max(0.1, maturityYears - credit.grace_period / 12)
  return credit.repayment_type === 'yearly' ? repaymentYears : repaymentYears * 12
}

export const calculatePayments = (credit: NewCreditForm) => {
  // Reuse the shared schedule for the structural math (counts, dates, guards,
  // equal-principal split).
  const schedule = calculatePaymentSchedule({
    start_date: credit.start_date,
    maturity_date: credit.maturity_date,
    amount: credit.amount,
    grace_period: credit.grace_period,
    interest_rate: credit.interest_rate,
    principal_repayment_type: credit.principal_repayment_type,
    interest_repayment_type: credit.interest_repayment_type,
  })
  if (!schedule) {
    return null
  }

  // Total interest from the amortizing annuity model (the same one persisted as
  // monthly_payment), spread across the interest payments — instead of the flat
  // full-principal-per-period interest the raw schedule would otherwise show.
  const totalInterest = Math.max(0, calculateRateAmount(credit) * annuityPaymentCount(credit) - credit.amount)
  const interestPerPayment = schedule.totalInterestPayments > 0
    ? totalInterest / schedule.totalInterestPayments
    : 0

  return {
    ...schedule,
    interestPerPayment,
    // Preserve the raw repayment-type labels the UI's `every_freq` string expects.
    principalFrequency: credit.principal_repayment_type,
    interestFrequency: credit.interest_repayment_type,
  }
}

export const createCredit = async (credit: NewCreditForm): Promise<void> => {
  const parts = credit.credit_type.split('_')
  const seniority = parts[parts.length - 1]
  const actualCreditType = parts.slice(0, -1).join('_')

  const { data: inserted, error } = await supabase
    .from('bank_credits')
    .insert({
      bank_id: credit.bank_id,
      company_id: credit.company_id || null,
      project_id: credit.project_id || null,
      credit_name: credit.credit_name,
      credit_type: actualCreditType,
      credit_seniority: seniority,
      amount: credit.amount,
      interest_rate: credit.interest_rate,
      start_date: credit.start_date || null,
      maturity_date: credit.maturity_date || null,
      usage_expiration_date: credit.usage_expiration_date || null,
      outstanding_balance: 0,
      monthly_payment: calculateRateAmount(credit),
      purpose: credit.purpose || null,
      grace_period: credit.grace_period,
      repayment_type: credit.repayment_type,
      principal_repayment_type: credit.principal_repayment_type,
      interest_repayment_type: credit.interest_repayment_type,
      disbursed_to_account: credit.disbursed_to_account || false,
      disbursed_to_bank_account_id: credit.disbursed_to_bank_account_id || null
    })
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({
    action: 'bank_credit.create',
    entity: 'bank_credit',
    entityId: inserted?.id ?? null,
    projectId: credit.project_id || null,
    metadata: { severity: 'high', entity_name: credit.credit_name, amount: credit.amount }
  })
}

export const updateCredit = async (creditId: string, credit: NewCreditForm): Promise<void> => {
  const parts = credit.credit_type.split('_')
  const seniority = parts[parts.length - 1]
  const actualCreditType = parts.slice(0, -1).join('_')

  const { error } = await supabase
    .from('bank_credits')
    .update({
      bank_id: credit.bank_id,
      company_id: credit.company_id || null,
      project_id: credit.project_id || null,
      credit_name: credit.credit_name,
      credit_type: actualCreditType,
      credit_seniority: seniority,
      amount: credit.amount,
      interest_rate: credit.interest_rate,
      start_date: credit.start_date || null,
      maturity_date: credit.maturity_date || null,
      outstanding_balance: credit.outstanding_balance,
      monthly_payment: calculateRateAmount(credit),
      purpose: credit.purpose,
      usage_expiration_date: credit.usage_expiration_date || null,
      grace_period: credit.grace_period,
      repayment_type: credit.repayment_type,
      principal_repayment_type: credit.principal_repayment_type,
      interest_repayment_type: credit.interest_repayment_type
    })
    .eq('id', creditId)

  if (error) throw error

  logActivity({
    action: 'bank_credit.update',
    entity: 'bank_credit',
    entityId: creditId,
    projectId: credit.project_id || null,
    metadata: { severity: 'high', entity_name: credit.credit_name }
  })
}

export const deleteCredit = async (creditId: string): Promise<void> => {
  const { error } = await supabase
    .from('bank_credits')
    .delete()
    .eq('id', creditId)

  if (error) throw error

  logActivity({
    action: 'bank_credit.delete',
    entity: 'bank_credit',
    entityId: creditId,
    metadata: { severity: 'high' }
  })
}

export interface CompanyBankAccount {
  id: string
  company_id: string
  bank_name: string
  account_number: string
  current_balance: number
}

export const fetchCompanyBankAccounts = async (companyId: string): Promise<CompanyBankAccount[]> => {
  const { data, error } = await supabase
    .from('company_bank_accounts')
    .select('id, company_id, bank_name, account_number, current_balance')
    .eq('company_id', companyId)

  if (error) throw error
  return data || []
}
