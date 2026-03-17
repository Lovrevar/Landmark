import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import type { BankCredit } from '../../../../lib/supabase'
import { INITIAL_CREDIT_FORM, type CreditFormData, type CompanyBankAccount } from '../types'
import { calculateAnnuityPayment, parseCreditTypeAndSeniority } from '../utils/creditCalculations'
import { useToast } from '../../../../contexts/ToastContext'

export function useCreditForm(onSaved: () => Promise<void>) {
  const toast = useToast()
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [editingCredit, setEditingCredit] = useState<BankCredit | null>(null)
  const [newCredit, setNewCredit] = useState<CreditFormData>({ ...INITIAL_CREDIT_FORM })
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  useEffect(() => {
    if (newCredit.company_id && newCredit.disbursed_to_account) {
      fetchCompanyBankAccounts(newCredit.company_id)
    } else {
      setCompanyBankAccounts([])
    }
  }, [newCredit.company_id, newCredit.disbursed_to_account])

  const fetchCompanyBankAccounts = async (companyId: string) => {
    try {
      setLoadingAccounts(true)
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select(`id, company_id, bank_name, account_number, current_balance`)
        .eq('company_id', companyId)

      if (error) throw error
      setCompanyBankAccounts(data || [])
    } catch (error) {
      console.error('Error fetching company bank accounts:', error)
      setCompanyBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  const handleEditCredit = (credit: BankCredit) => {
    setEditingCredit(credit)
    setNewCredit({
      bank_id: credit.bank_id,
      company_id: credit.company_id || '',
      project_id: credit.project_id || '',
      credit_name: credit.credit_name || '',
      credit_type: `${credit.credit_type}_${credit.credit_seniority}`,
      amount: credit.amount,
      interest_rate: credit.interest_rate,
      start_date: credit.start_date || '',
      maturity_date: credit.maturity_date || '',
      outstanding_balance: credit.outstanding_balance,
      monthly_payment: credit.monthly_payment,
      purpose: credit.purpose || '',
      usage_expiration_date: credit.usage_expiration_date || '',
      grace_period: credit.grace_period || 0,
      repayment_type: credit.repayment_type,
      credit_seniority: credit.credit_seniority,
      principal_repayment_type: credit.principal_repayment_type || 'yearly',
      interest_repayment_type: credit.interest_repayment_type || 'monthly',
      disbursed_to_account: credit.disbursed_to_account || false,
      disbursed_to_bank_account_id: credit.disbursed_to_bank_account_id || ''
    })
    setShowCreditForm(true)
  }

  const resetCreditForm = () => {
    setNewCredit({ ...INITIAL_CREDIT_FORM })
    setEditingCredit(null)
    setShowCreditForm(false)
  }

  const addCredit = async () => {
    if (editingCredit) {
      await handleUpdateCredit()
      return
    }

    if (!newCredit.bank_id || !newCredit.credit_name || !newCredit.amount || !newCredit.start_date) {
      toast.warning('Please fill in required fields (Bank, Credit Name, Amount, Start Date)')
      return
    }

    const monthlyPayment = calculateAnnuityPayment({
      amount: newCredit.amount,
      interest_rate: newCredit.interest_rate,
      grace_period: newCredit.grace_period,
      start_date: newCredit.start_date,
      maturity_date: newCredit.maturity_date || null,
      repayment_type: newCredit.repayment_type,
    })

    const { creditType: actualCreditType, seniority } = parseCreditTypeAndSeniority(newCredit.credit_type)

    try {
      const { error } = await supabase
        .from('bank_credits')
        .insert({
          ...newCredit,
          company_id: newCredit.company_id || null,
          project_id: newCredit.project_id || null,
          start_date: newCredit.start_date || null,
          maturity_date: newCredit.maturity_date || null,
          usage_expiration_date: newCredit.usage_expiration_date || null,
          disbursed_to_bank_account_id: newCredit.disbursed_to_account && newCredit.disbursed_to_bank_account_id ? newCredit.disbursed_to_bank_account_id : null,
          credit_type: actualCreditType,
          credit_seniority: seniority,
          outstanding_balance: 0,
          monthly_payment: monthlyPayment,
          principal_repayment_type: newCredit.principal_repayment_type,
          interest_repayment_type: newCredit.interest_repayment_type
        })

      if (error) throw error

      resetCreditForm()
      await onSaved()
    } catch (error) {
      console.error('Error adding credit:', error)
      toast.error('Error adding credit facility.')
    }
  }

  const handleUpdateCredit = async () => {
    if (!editingCredit) return

    if (!newCredit.bank_id || !newCredit.credit_name || !newCredit.amount || !newCredit.start_date) {
      toast.warning('Please fill in all required fields')
      return
    }

    const monthlyPayment = calculateAnnuityPayment({
      amount: newCredit.amount,
      interest_rate: newCredit.interest_rate,
      grace_period: newCredit.grace_period,
      start_date: newCredit.start_date,
      maturity_date: newCredit.maturity_date || null,
      repayment_type: newCredit.repayment_type,
    })

    const { creditType: actualCreditType, seniority } = parseCreditTypeAndSeniority(newCredit.credit_type)

    try {
      const { error } = await supabase
        .from('bank_credits')
        .update({
          bank_id: newCredit.bank_id,
          company_id: newCredit.company_id || null,
          project_id: newCredit.project_id || null,
          credit_name: newCredit.credit_name,
          credit_type: actualCreditType,
          credit_seniority: seniority,
          amount: newCredit.amount,
          interest_rate: newCredit.interest_rate,
          start_date: newCredit.start_date,
          maturity_date: newCredit.maturity_date,
          outstanding_balance: newCredit.outstanding_balance,
          monthly_payment: monthlyPayment,
          purpose: newCredit.purpose,
          usage_expiration_date: newCredit.usage_expiration_date || null,
          grace_period: newCredit.grace_period,
          repayment_type: newCredit.repayment_type,
          principal_repayment_type: newCredit.principal_repayment_type,
          interest_repayment_type: newCredit.interest_repayment_type,
          disbursed_to_account: newCredit.disbursed_to_account || false,
          disbursed_to_bank_account_id: newCredit.disbursed_to_account && newCredit.disbursed_to_bank_account_id ? newCredit.disbursed_to_bank_account_id : null
        })
        .eq('id', editingCredit.id)

      if (error) throw error

      resetCreditForm()
      await onSaved()
    } catch (error) {
      console.error('Error updating credit:', error)
      toast.error('Error updating credit facility.')
    }
  }

  const handleDeleteCredit = async (creditId: string) => {
    if (!confirm('Are you sure you want to delete this credit facility?')) return
    try {
      const { error } = await supabase.from('bank_credits').delete().eq('id', creditId)
      if (error) throw error
      await onSaved()
    } catch (error) {
      console.error('Error deleting credit:', error)
      toast.error('Error deleting credit facility.')
    }
  }

  return {
    showCreditForm,
    setShowCreditForm,
    editingCredit,
    newCredit,
    setNewCredit,
    companyBankAccounts,
    loadingAccounts,
    handleEditCredit,
    resetCreditForm,
    addCredit,
    handleDeleteCredit,
  }
}
