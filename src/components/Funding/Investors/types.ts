import type { Bank, BankCredit } from '../../../lib/supabase'

export interface BankWithCredits extends Bank {
  credits: BankCredit[]
  total_credits: number
  active_credits: number
  credit_utilization: number
  credit_utilized: number
  outstanding_debt: number
  available_funds: number
}

export interface Company {
  id: string
  name: string
  oib: string
}

export const INITIAL_CREDIT_FORM = {
  bank_id: '',
  company_id: '',
  project_id: '',
  credit_name: '',
  credit_type: 'construction_loan_senior' as string,
  amount: 0,
  interest_rate: 0,
  start_date: '',
  maturity_date: '' as string,
  outstanding_balance: 0,
  monthly_payment: 0,
  purpose: '',
  usage_expiration_date: '',
  grace_period: 0,
  repayment_type: 'monthly' as 'monthly' | 'yearly',
  credit_seniority: 'senior' as 'junior' | 'senior',
  principal_repayment_type: 'yearly' as 'monthly' | 'quarterly' | 'biyearly' | 'yearly',
  interest_repayment_type: 'monthly' as 'monthly' | 'quarterly' | 'biyearly' | 'yearly',
  disbursed_to_account: false,
  disbursed_to_bank_account_id: ''
}

export const INITIAL_EQUITY_FORM = {
  bank_id: '',
  company_id: '',
  investment_type: 'equity' as const,
  amount: 0,
  percentage_stake: 0,
  expected_return: 0,
  investment_date: '',
  maturity_date: '',
  payment_schedule: 'yearly' as 'monthly' | 'yearly' | 'custom',
  terms: '',
  notes: '',
  usage_expiration_date: '',
  grace_period: 0,
  custom_payment_count: 0,
  custom_payments: [] as { date: string; amount: number }[]
}

export const INITIAL_BANK_FORM = {
  name: '',
  contact_person: '',
  contact_email: '',
  contact_phone: ''
}

export type CreditFormData = typeof INITIAL_CREDIT_FORM
export type EquityFormData = typeof INITIAL_EQUITY_FORM
export type BankFormData = typeof INITIAL_BANK_FORM

export interface CompanyBankAccount {
  id: string
  bank_name: string | null
  account_number: string | null
  current_balance: number
}

export interface PaymentScheduleCalculation {
  principalPerPayment: number
  interestPerPayment: number
  totalPrincipalPayments: number
  totalInterestPayments: number
  paymentStartDate: Date
  principalFrequency: string
  interestFrequency: string
}
