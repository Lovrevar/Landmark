import { useState, useEffect } from 'react'
import { CompanyStats, CompanyFormData } from '../types'
import { lockBodyScroll, unlockBodyScroll } from '../../../../hooks/useModalOverflow'
import {
  fetchCompaniesWithStats,
  fetchBankAccountsForCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  fetchCompanyDetails
} from '../Services/companyService'
import { useToast } from '../../../../contexts/ToastContext'

export const useCompanies = () => {
  const toast = useToast()
  const [companies, setCompanies] = useState<CompanyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyStats | null>(null)
  const [editingCompany, setEditingCompany] = useState<string | null>(null)

  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    oib: '',
    accountCount: 1,
    bankAccounts: [{ bank_name: '', current_balance: 0 }]
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const companiesWithStats = await fetchCompaniesWithStats()
      setCompanies(companiesWithStats)
    } catch (error) {
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAddModal = async (company?: CompanyStats) => {
    if (company) {
      setEditingCompany(company.id)

      const bankAccountsForEdit = await fetchBankAccountsForCompany(company.id)

      setFormData({
        name: company.name,
        oib: company.oib,
        accountCount: bankAccountsForEdit.length || 1,
        bankAccounts: bankAccountsForEdit.length > 0 ? bankAccountsForEdit : [{ bank_name: '', current_balance: 0 }]
      })
    } else {
      setEditingCompany(null)
      setFormData({
        name: '',
        oib: '',
        accountCount: 1,
        bankAccounts: [{ bank_name: '', current_balance: 0 }]
      })
    }
    lockBodyScroll()
    setShowAddModal(true)
  }

  const handleCloseAddModal = () => {
    setFormData({ name: '', oib: '', accountCount: 1, bankAccounts: [{ bank_name: '', current_balance: 0 }] })
    unlockBodyScroll()
    setShowAddModal(false)
    setEditingCompany(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingCompany) {
        await updateCompany(editingCompany, formData)
      } else {
        await createCompany(formData)
      }

      await fetchData()
      handleCloseAddModal()
    } catch (error: unknown) {
      console.error('Error saving company:', error)
      if ((error as { code?: string })?.code === '23505') {
        toast.error('OIB već postoji u sustavu!')
      } else {
        toast.error('Greška prilikom spremanja firme')
      }
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = (id: string) => setPendingDeleteId(id)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteCompany(pendingDeleteId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting company:', error)
      toast.error('Greška prilikom brisanja firme')
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const cancelDelete = () => setPendingDeleteId(null)

  const handleViewDetails = async (company: CompanyStats) => {
    try {
      const { bankAccounts, credits, invoices } = await fetchCompanyDetails(company.id)

      const companyWithDetails = {
        ...company,
        bank_accounts: bankAccounts,
        credits,
        invoices
      }

      setSelectedCompany(companyWithDetails)
      lockBodyScroll()
      setShowDetailsModal(true)
    } catch (error) {
      console.error('Error loading company details:', error)
      toast.error('Greška pri učitavanju detalja firme')
    }
  }

  const handleCloseDetailsModal = () => {
    unlockBodyScroll()
    setShowDetailsModal(false)
    setSelectedCompany(null)
  }

  const handleAccountCountChange = (count: number) => {
    const newCount = Math.max(1, Math.min(10, count))
    const currentAccounts = formData.bankAccounts

    if (newCount > currentAccounts.length) {
      const newAccounts = [...currentAccounts]
      for (let i = currentAccounts.length; i < newCount; i++) {
        newAccounts.push({ bank_name: '', current_balance: 0 })
      }
      setFormData({ ...formData, accountCount: newCount, bankAccounts: newAccounts })
    } else if (newCount < currentAccounts.length) {
      setFormData({ ...formData, accountCount: newCount, bankAccounts: currentAccounts.slice(0, newCount) })
    }
  }

  const handleBankAccountChange = (index: number, field: 'bank_name' | 'current_balance' | 'balance_reset_at', value: string | number | null) => {
    const newAccounts = [...formData.bankAccounts]
    newAccounts[index] = { ...newAccounts[index], [field]: value }
    setFormData({ ...formData, bankAccounts: newAccounts })
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.oib.includes(searchTerm)
  )

  const totalBalance = companies.reduce((sum, c) => sum + c.current_balance, 0)
  const totalRevenue = companies.reduce((sum, c) => sum + c.revenue, 0)
  const totalProfit = companies.reduce((sum, c) => sum + c.profit, 0)

  const handleFormDataChange = (field: keyof CompanyFormData, value: CompanyFormData[keyof CompanyFormData]) => {
    setFormData({ ...formData, [field]: value })
  }

  return {
    companies,
    loading,
    searchTerm,
    setSearchTerm,
    showAddModal,
    showDetailsModal,
    selectedCompany,
    editingCompany,
    formData,
    handleOpenAddModal,
    handleCloseAddModal,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    handleViewDetails,
    handleCloseDetailsModal,
    handleAccountCountChange,
    handleBankAccountChange,
    handleFormDataChange,
    filteredCompanies,
    totalBalance,
    totalRevenue,
    totalProfit
  }
}
