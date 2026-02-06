import { supabase } from '../../../lib/supabase'
import { BankWithCredits, Project, Company, NewCreditForm, BankCredit } from '../types/bankTypes'

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

  const banksWithCredits: BankWithCredits[] = []

  for (const bank of banksData || []) {
    const { data: creditsData, error: creditsError } = await supabase
      .from('bank_credits')
      .select(`
        *,
        used_amount,
        repaid_amount,
        projects(id, name),
        accounting_companies(name)
      `)
      .eq('bank_id', bank.id)
      .order('start_date', { ascending: false })

    if (creditsError) throw creditsError

    const credits = creditsData || []
    const totalCreditLimit = credits.reduce((sum, c) => sum + c.amount, 0)
    const totalUsed = credits.reduce((sum, c) => sum + (c.used_amount || 0), 0)
    const totalRepaid = credits.reduce((sum, c) => sum + (c.repaid_amount || 0), 0)
    const totalOutstanding = credits.reduce((sum, c) => sum + c.outstanding_balance, 0)

    banksWithCredits.push({
      ...bank,
      total_credit_limit: totalCreditLimit,
      total_used: totalUsed,
      total_repaid: totalRepaid,
      total_outstanding: totalOutstanding,
      credits
    })
  }

  return banksWithCredits
}

export const calculateRateAmount = (credit: NewCreditForm): number => {
  const principal = credit.amount
  const annualRate = credit.interest_rate / 100
  const gracePeriodYears = credit.grace_period / 365

  let maturityYears = 10
  if (credit.maturity_date && credit.start_date) {
    const startDate = new Date(credit.start_date)
    const maturityDate = new Date(credit.maturity_date)
    maturityYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  }

  const repaymentYears = Math.max(0.1, maturityYears - gracePeriodYears)

  if (annualRate === 0) {
    return credit.repayment_type === 'yearly'
      ? principal / repaymentYears
      : principal / (repaymentYears * 12)
  }

  if (credit.repayment_type === 'yearly') {
    const yearlyRate = annualRate
    return (principal * yearlyRate * Math.pow(1 + yearlyRate, repaymentYears)) /
           (Math.pow(1 + yearlyRate, repaymentYears) - 1)
  } else {
    const monthlyRate = annualRate / 12
    const totalMonths = repaymentYears * 12
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
           (Math.pow(1 + monthlyRate, totalMonths) - 1)
  }
}

export const getPaymentFrequency = (type: string): number => {
  switch (type) {
    case 'monthly': return 12
    case 'quarterly': return 4
    case 'biyearly': return 2
    case 'yearly': return 1
    default: return 12
  }
}

export const calculatePayments = (credit: NewCreditForm) => {
  if (!credit.start_date || !credit.maturity_date || !credit.amount) {
    return null
  }

  const startDate = new Date(credit.start_date)
  const endDate = new Date(credit.maturity_date)
  const gracePeriodMonths = credit.grace_period || 0

  const paymentStartDate = new Date(startDate)
  paymentStartDate.setMonth(paymentStartDate.getMonth() + gracePeriodMonths)

  if (paymentStartDate >= endDate) {
    return null
  }

  const totalYears = (endDate.getTime() - paymentStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

  const principalFreq = getPaymentFrequency(credit.principal_repayment_type)
  const interestFreq = getPaymentFrequency(credit.interest_repayment_type)

  const totalPrincipalPayments = Math.floor(totalYears * principalFreq)
  const totalInterestPayments = Math.floor(totalYears * interestFreq)

  const principalPerPayment = totalPrincipalPayments > 0 ? credit.amount / totalPrincipalPayments : 0

  const annualInterest = credit.amount * (credit.interest_rate / 100)
  const interestPerPayment = totalInterestPayments > 0 ? annualInterest / interestFreq : 0

  return {
    principalPerPayment,
    interestPerPayment,
    totalPrincipalPayments,
    totalInterestPayments,
    paymentStartDate,
    principalFrequency: credit.principal_repayment_type,
    interestFrequency: credit.interest_repayment_type
  }
}

export const createCredit = async (credit: NewCreditForm): Promise<void> => {
  const parts = credit.credit_type.split('_')
  const seniority = parts[parts.length - 1]
  const actualCreditType = parts.slice(0, -1).join('_')

  const { error } = await supabase
    .from('bank_credits')
    .insert({
      ...credit,
      company_id: credit.company_id || null,
      project_id: credit.project_id || null,
      credit_type: actualCreditType,
      credit_seniority: seniority,
      outstanding_balance: credit.outstanding_balance || credit.amount,
      monthly_payment: calculateRateAmount(credit),
      principal_repayment_type: credit.principal_repayment_type,
      interest_repayment_type: credit.interest_repayment_type
    })

  if (error) throw error
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
      start_date: credit.start_date,
      maturity_date: credit.maturity_date,
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
}

export const deleteCredit = async (creditId: string): Promise<void> => {
  const { error } = await supabase
    .from('bank_credits')
    .delete()
    .eq('id', creditId)

  if (error) throw error
}
