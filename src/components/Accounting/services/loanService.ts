import { supabase } from '../../../lib/supabase'
import { CompanyLoan, Company, BankAccount } from '../types/loanTypes'

export const fetchLoans = async () => {
  const { data, error } = await supabase
    .from('company_loans')
    .select(`
      *,
      from_company:accounting_companies!from_company_id(name),
      to_company:accounting_companies!to_company_id(name),
      from_bank_account:company_bank_accounts!from_bank_account_id(bank_name, account_number),
      to_bank_account:company_bank_accounts!to_bank_account_id(bank_name, account_number)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as CompanyLoan[]
}

export const fetchCompanies = async () => {
  const { data, error } = await supabase
    .from('accounting_companies')
    .select('id, name, oib')
    .order('name')

  if (error) throw error
  return data as Company[]
}

export const fetchBankAccounts = async () => {
  const { data, error } = await supabase
    .from('company_bank_accounts')
    .select('id, company_id, bank_name, account_number, current_balance')
    .order('bank_name')

  if (error) throw error
  return data as BankAccount[]
}

export const createLoan = async (loanData: {
  from_company_id: string
  from_bank_account_id: string
  to_company_id: string
  to_bank_account_id: string
  amount: number
  loan_date: string | null
}) => {
  const { data, error } = await supabase
    .from('company_loans')
    .insert(loanData)

  if (error) throw error
  return data
}

export const deleteLoan = async (loanId: string) => {
  const { error } = await supabase
    .from('company_loans')
    .delete()
    .eq('id', loanId)

  if (error) throw error
}
