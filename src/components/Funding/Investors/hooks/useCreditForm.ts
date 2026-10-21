import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { BankCredit } from '../../../../lib/supabase'
import { INITIAL_CREDIT_FORM, type CreditFormData, type CompanyBankAccount } from '../types'
import { calculateMonthlyDebtService, parseCreditTypeAndSeniority } from '../utils/creditCalculations'
import { useToast } from '../../../../contexts/ToastContext'
import { isForeignKeyViolation } from '../../../../lib/dbErrors'
import {
  fetchCompanyBankAccounts,
  createCredit,
  updateCredit,
  deleteCredit,
  countInvoicesForCredits,
} from '../services/creditService'

export function useCreditForm(onSaved: () => Promise<void>) {
  const toast = useToast()
  const { t } = useTranslation()
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [editingCredit, setEditingCredit] = useState<BankCredit | null>(null)
  const [newCredit, setNewCredit] = useState<CreditFormData>({ ...INITIAL_CREDIT_FORM })
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  useEffect(() => {
    if (newCredit.company_id && newCredit.disbursed_to_account) {
      loadCompanyBankAccounts(newCredit.company_id)
    } else {
      setCompanyBankAccounts([])
    }
  }, [newCredit.company_id, newCredit.disbursed_to_account])

  const loadCompanyBankAccounts = async (companyId: string) => {
    try {
      setLoadingAccounts(true)
      setCompanyBankAccounts(await fetchCompanyBankAccounts(companyId))
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
      disbursed_to_bank_account_id: credit.disbursed_to_bank_account_id || '',
      status: (credit.status as 'active' | 'paid' | 'defaulted') || 'active'
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
      toast.warning(t('funding.investors.error_credit_fields_required'))
      return
    }
    // The form marks the account required once "disbursed to account" is ticked, but nothing
    // checked it: the save went to the database, whose CHECK refused it with a generic error (FUND-6).
    if (newCredit.disbursed_to_account && !newCredit.disbursed_to_bank_account_id) {
      toast.warning(t('funding.investors.error_disbursement_account_required'))
      return
    }

    // Equal principal instalments with interest on the outstanding balance (FUND-5); stored as
    // the monthly-equivalent debt service, so the credit is labelled with a monthly instalment.
    const monthlyPayment = calculateMonthlyDebtService({
      amount: newCredit.amount,
      interest_rate: newCredit.interest_rate,
      grace_period: newCredit.grace_period,
      start_date: newCredit.start_date,
      maturity_date: newCredit.maturity_date || null,
      principal_repayment_type: newCredit.principal_repayment_type,
      interest_repayment_type: newCredit.interest_repayment_type,
    })

    const { creditType: actualCreditType, seniority } = parseCreditTypeAndSeniority(newCredit.credit_type)

    try {
      await createCredit({ ...newCredit, repayment_type: 'monthly' }, {
        credit_type: actualCreditType,
        credit_seniority: seniority,
        monthly_payment: monthlyPayment,
      })
      resetCreditForm()
      await onSaved()
    } catch (error) {
      console.error('Error adding credit:', error)
      toast.error(t('funding.investors.error_add_credit'))
    }
  }

  const handleUpdateCredit = async () => {
    if (!editingCredit) return

    if (!newCredit.bank_id || !newCredit.credit_name || !newCredit.amount || !newCredit.start_date) {
      toast.warning(t('funding.investors.error_credit_fields_required'))
      return
    }
    // The form marks the account required once "disbursed to account" is ticked, but nothing
    // checked it: the save went to the database, whose CHECK refused it with a generic error (FUND-6).
    if (newCredit.disbursed_to_account && !newCredit.disbursed_to_bank_account_id) {
      toast.warning(t('funding.investors.error_disbursement_account_required'))
      return
    }

    // Equal principal instalments with interest on the outstanding balance (FUND-5); stored as
    // the monthly-equivalent debt service, so the credit is labelled with a monthly instalment.
    const monthlyPayment = calculateMonthlyDebtService({
      amount: newCredit.amount,
      interest_rate: newCredit.interest_rate,
      grace_period: newCredit.grace_period,
      start_date: newCredit.start_date,
      maturity_date: newCredit.maturity_date || null,
      principal_repayment_type: newCredit.principal_repayment_type,
      interest_repayment_type: newCredit.interest_repayment_type,
    })

    const { creditType: actualCreditType, seniority } = parseCreditTypeAndSeniority(newCredit.credit_type)

    try {
      await updateCredit(editingCredit.id, { ...newCredit, repayment_type: 'monthly' }, {
        credit_type: actualCreditType,
        credit_seniority: seniority,
        monthly_payment: monthlyPayment,
      })
      resetCreditForm()
      await onSaved()
    } catch (error) {
      console.error('Error updating credit:', error)
      toast.error(t('funding.investors.error_update_credit'))
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeleteInvoiceCount, setPendingDeleteInvoiceCount] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // null = not looked up yet, or the lookup failed; the dialog just omits the warning line.
  const handleDeleteCredit = async (creditId: string) => {
    setPendingDeleteId(creditId)
    setPendingDeleteInvoiceCount(null)
    try {
      setPendingDeleteInvoiceCount(await countInvoicesForCredits([creditId]))
    } catch (error) {
      console.error('Error counting invoices linked to credit:', error)
    }
  }

  const confirmDeleteCredit = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteCredit(pendingDeleteId)
      await onSaved()
    } catch (error) {
      console.error('Error deleting credit:', error)
      toast.error(
        isForeignKeyViolation(error)
          ? t('funding.investors.error_delete_credit_linked')
          : t('funding.investors.error_delete_credit'),
      )
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
      setPendingDeleteInvoiceCount(null)
    }
  }

  const cancelDeleteCredit = () => {
    setPendingDeleteId(null)
    setPendingDeleteInvoiceCount(null)
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
    confirmDeleteCredit,
    cancelDeleteCredit,
    pendingDeleteId,
    pendingDeleteInvoiceCount,
    deleting,
  }
}
