import { useState, useEffect } from 'react'
import { BankWithCredits, Project, Company, BankCredit, NewCreditForm } from '../types/bankTypes'
import { fetchProjects, fetchCompanies, fetchBanksWithCredits, createCredit, updateCredit, deleteCredit } from '../services/bankService'
import { useModalOverflow } from '../../../hooks/useModalOverflow'

export const useBanks = () => {
  const [banks, setBanks] = useState<BankWithCredits[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [editingCredit, setEditingCredit] = useState<BankCredit | null>(null)
  const [newCredit, setNewCredit] = useState<NewCreditForm>({
    bank_id: '',
    company_id: '',
    project_id: '',
    credit_name: '',
    credit_type: 'construction_loan_senior',
    amount: 0,
    interest_rate: 0,
    start_date: '',
    maturity_date: '',
    outstanding_balance: 0,
    monthly_payment: 0,
    purpose: '',
    usage_expiration_date: '',
    grace_period: 0,
    repayment_type: 'monthly',
    credit_seniority: 'senior',
    principal_repayment_type: 'yearly',
    interest_repayment_type: 'monthly'
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [projectsData, companiesData, banksData] = await Promise.all([
        fetchProjects(),
        fetchCompanies(),
        fetchBanksWithCredits()
      ])
      setProjects(projectsData)
      setCompanies(companiesData)
      setBanks(banksData)
    } catch (error) {
      console.error('Error fetching banks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useModalOverflow(showCreditForm)

  const addCredit = async () => {
    if (editingCredit) {
      await handleUpdateCredit()
      return
    }

    if (!newCredit.bank_id || !newCredit.credit_name || !newCredit.amount || !newCredit.start_date) {
      alert('Please fill in required fields (Bank, Credit Name, Amount, Start Date)')
      return
    }

    try {
      await createCredit(newCredit)
      resetCreditForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding credit:', error)
      alert('Error adding credit facility.')
    }
  }

  const handleUpdateCredit = async () => {
    if (!editingCredit) return

    if (!newCredit.bank_id || !newCredit.credit_name || !newCredit.amount || !newCredit.start_date || !newCredit.maturity_date) {
      alert('Please fill in all required fields')
      return
    }

    try {
      await updateCredit(editingCredit.id, newCredit)
      resetCreditForm()
      await fetchData()
    } catch (error) {
      console.error('Error updating credit:', error)
      alert('Error updating credit facility.')
    }
  }

  const handleDeleteCredit = async (creditId: string) => {
    if (!confirm('Are you sure you want to delete this credit facility?')) return

    try {
      await deleteCredit(creditId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting credit:', error)
      alert('Error deleting credit facility.')
    }
  }

  const handleEditCredit = (credit: BankCredit) => {
    setEditingCredit(credit)
    setNewCredit({
      bank_id: credit.bank_id,
      company_id: credit.company_id || '',
      project_id: credit.project_id || '',
      credit_name: credit.credit_name || '',
      credit_type: `${credit.credit_type}_${credit.credit_seniority}` as any,
      amount: credit.amount,
      interest_rate: credit.interest_rate,
      start_date: credit.start_date,
      maturity_date: credit.maturity_date,
      outstanding_balance: credit.outstanding_balance,
      monthly_payment: credit.monthly_payment,
      purpose: credit.purpose || '',
      usage_expiration_date: credit.usage_expiration_date || '',
      grace_period: credit.grace_period || 0,
      repayment_type: credit.repayment_type as any,
      credit_seniority: credit.credit_seniority as any,
      principal_repayment_type: credit.principal_repayment_type || 'yearly',
      interest_repayment_type: credit.interest_repayment_type || 'monthly'
    })
    setShowCreditForm(true)
  }

  const resetCreditForm = () => {
    setNewCredit({
      bank_id: '',
      company_id: '',
      project_id: '',
      credit_name: '',
      credit_type: 'construction_loan_senior',
      amount: 0,
      interest_rate: 0,
      start_date: '',
      maturity_date: '',
      outstanding_balance: 0,
      monthly_payment: 0,
      purpose: '',
      usage_expiration_date: '',
      grace_period: 0,
      repayment_type: 'monthly',
      credit_seniority: 'senior',
      principal_repayment_type: 'yearly',
      interest_repayment_type: 'monthly'
    })
    setEditingCredit(null)
    setShowCreditForm(false)
  }

  return {
    banks,
    projects,
    companies,
    loading,
    showCreditForm,
    setShowCreditForm,
    editingCredit,
    newCredit,
    setNewCredit,
    addCredit,
    handleEditCredit,
    handleDeleteCredit,
    resetCreditForm
  }
}
