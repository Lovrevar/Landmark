import { supabase } from '../../../lib/supabase'
import type { Company, Project, CreditWithCompany, CreditFormData } from '../types/creditTypes'

export const fetchCompanies = async (): Promise<Company[]> => {
  const { data } = await supabase
    .from('accounting_companies')
    .select('*')
    .order('name')
  return data || []
}

export const fetchProjects = async (): Promise<Project[]> => {
  const { data } = await supabase
    .from('projects')
    .select('id, name')
    .order('name')
  return data || []
}

export const fetchCredits = async (): Promise<CreditWithCompany[]> => {
  const { data } = await supabase
    .from('bank_credits')
    .select(`
      *,
      used_amount,
      repaid_amount,
      company:accounting_companies(id, name, oib),
      project:projects(id, name)
    `)
    .order('created_at', { ascending: false })
  return data || []
}

export const fetchAllData = async () => {
  const [companiesData, projectsData, creditsData] = await Promise.all([
    fetchCompanies(),
    fetchProjects(),
    fetchCredits()
  ])

  return {
    companies: companiesData,
    projects: projectsData,
    credits: creditsData
  }
}

export const createCredit = async (formData: CreditFormData) => {
  const { error } = await supabase
    .from('bank_credits')
    .insert([{
      company_id: formData.company_id,
      project_id: formData.project_id || null,
      credit_name: formData.credit_name,
      start_date: formData.start_date,
      maturity_date: formData.end_date,
      grace_period: formData.grace_period_months * 30,
      interest_rate: formData.interest_rate,
      amount: formData.initial_amount,
      outstanding_balance: 0,
      credit_type: 'equity',
      status: 'active',
      purpose: formData.credit_name,
      disbursed_to_account: formData.disbursed_to_account || false,
      disbursed_to_bank_account_id: formData.disbursed_to_bank_account_id || null
    }])

  if (error) throw error
}

export const updateCredit = async (creditId: string, formData: CreditFormData) => {
  const { error } = await supabase
    .from('bank_credits')
    .update({
      company_id: formData.company_id,
      project_id: formData.project_id || null,
      credit_name: formData.credit_name,
      start_date: formData.start_date,
      maturity_date: formData.end_date,
      grace_period: formData.grace_period_months * 30,
      interest_rate: formData.interest_rate,
      amount: formData.initial_amount,
      disbursed_to_account: formData.disbursed_to_account || false,
      disbursed_to_bank_account_id: formData.disbursed_to_bank_account_id || null
    })
    .eq('id', creditId)

  if (error) throw error
}

export const deleteCredit = async (creditId: string) => {
  const { error } = await supabase
    .from('bank_credits')
    .delete()
    .eq('id', creditId)

  if (error) throw error
}
