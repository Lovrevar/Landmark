import { useState, useEffect } from 'react'
import type { Company, Project, CreditWithCompany, Credit, CreditFormData } from '../types/creditTypes'
import { fetchAllData, createCredit, updateCredit, deleteCredit } from '../services/creditService'
import { useModalOverflow } from '../../../hooks/useModalOverflow'

const initialFormData: CreditFormData = {
  company_id: '',
  project_id: '',
  credit_name: '',
  start_date: '',
  end_date: '',
  grace_period_months: 0,
  interest_rate: 0,
  initial_amount: 0,
  disbursed_to_account: false,
  disbursed_to_bank_account_id: undefined
}

export const useCredits = () => {
  const [credits, setCredits] = useState<CreditWithCompany[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null)
  const [formData, setFormData] = useState<CreditFormData>(initialFormData)

  useEffect(() => {
    fetchData()
  }, [])

  useModalOverflow(showModal)

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await fetchAllData()
      setCompanies(data.companies)
      setProjects(data.projects)
      setCredits(data.credits)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingCredit(null)
  }

  const handleOpenModal = (credit?: Credit & { disbursed_to_account?: boolean, disbursed_to_bank_account_id?: string }) => {
    if (credit) {
      setEditingCredit(credit)
      setFormData({
        company_id: credit.company_id,
        project_id: credit.project_id || '',
        credit_name: credit.credit_name,
        start_date: credit.start_date,
        end_date: credit.maturity_date,
        grace_period_months: Math.round(credit.grace_period / 30),
        interest_rate: credit.interest_rate,
        initial_amount: credit.amount,
        disbursed_to_account: credit.disbursed_to_account || false,
        disbursed_to_bank_account_id: credit.disbursed_to_bank_account_id || undefined
      })
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingCredit) {
        await updateCredit(editingCredit.id, formData)
      } else {
        await createCredit(formData)
      }

      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving credit:', error)
      alert('Error saving credit')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credit?')) return

    try {
      await deleteCredit(id)
      await fetchData()
    } catch (error) {
      console.error('Error deleting credit:', error)
      alert('Error deleting credit')
    }
  }

  return {
    credits,
    companies,
    projects,
    loading,
    showModal,
    editingCredit,
    formData,
    setFormData,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete
  }
}
