import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { CompanyLoan, Company, BankAccount, LoanFormData } from '../types'
import { fetchLoans, fetchCompanies, fetchBankAccounts, createLoan, deleteLoan } from '../Services/loanService'
import { useToast } from '../../../../contexts/ToastContext'

export const useLoans = () => {
  const toast = useToast()
  const [loans, setLoans] = useState<CompanyLoan[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const [formData, setFormData] = useState<LoanFormData>({
    from_company_id: '',
    from_bank_account_id: '',
    to_company_id: '',
    to_bank_account_id: '',
    amount: '',
    loan_date: format(new Date(), 'yyyy-MM-dd')
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [loansData, companiesData, accountsData] = await Promise.all([
        fetchLoans(),
        fetchCompanies(),
        fetchBankAccounts()
      ])

      setLoans(loansData)
      setCompanies(companiesData)
      setBankAccounts(accountsData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: Record<string, string> = {}
    if (!formData.from_company_id) errors.from_company_id = 'Odaberite firmu koja daje'
    if (!formData.from_bank_account_id) errors.from_bank_account_id = 'Odaberite račun'
    if (!formData.to_company_id) errors.to_company_id = 'Odaberite firmu koja prima'
    if (!formData.to_bank_account_id) errors.to_bank_account_id = 'Odaberite račun'
    if (!formData.amount) errors.amount = 'Unesite iznos'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      await createLoan({
        from_company_id: formData.from_company_id,
        from_bank_account_id: formData.from_bank_account_id,
        to_company_id: formData.to_company_id,
        to_bank_account_id: formData.to_bank_account_id,
        amount: parseFloat(formData.amount),
        loan_date: formData.loan_date || null
      })

      await fetchData()
      setShowAddModal(false)
      resetForm()
      setFieldErrors({})
    } catch (error) {
      console.error('Error creating loan:', error)
      toast.error('Greška pri kreiranju pozajmice')
    }
  }

  const handleDeleteLoan = async (loanId: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu pozajmicu?')) return

    try {
      await deleteLoan(loanId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting loan:', error)
      toast.error('Greška pri brisanju pozajmice')
    }
  }

  const resetForm = () => {
    setFormData({
      from_company_id: '',
      from_bank_account_id: '',
      to_company_id: '',
      to_bank_account_id: '',
      amount: '',
      loan_date: format(new Date(), 'yyyy-MM-dd')
    })
  }

  const getFromCompanyAccounts = () => {
    return bankAccounts.filter(acc => acc.company_id === formData.from_company_id)
  }

  const getToCompanyAccounts = () => {
    return bankAccounts.filter(acc => acc.company_id === formData.to_company_id)
  }

  const filteredLoans = loans.filter(loan =>
    loan.from_company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.to_company.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return {
    loans,
    companies,
    bankAccounts,
    loading,
    searchTerm,
    setSearchTerm,
    showAddModal,
    setShowAddModal,
    formData,
    setFormData,
    fieldErrors,
    handleAddLoan,
    handleDeleteLoan,
    resetForm,
    getFromCompanyAccounts,
    getToCompanyAccounts,
    filteredLoans
  }
}
