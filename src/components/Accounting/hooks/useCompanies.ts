import { useState, useEffect } from 'react'
import { CompanyStats, CompanyFormData } from '../types/companyTypes'
import { lockBodyScroll, unlockBodyScroll } from '../../../hooks/useModalOverflow'
import {
  fetchCompaniesWithStats,
  fetchBankAccountsForCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  fetchCompanyDetails
} from '../services/companyService'

export const useCompanies = () => {
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
    } catch (error: any) {
      console.error('Error saving company:', error)
      if (error.code === '23505') {
        alert('OIB već postoji u sustavu!')
      } else {
        alert('Greška prilikom spremanja firme')
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu firmu? Svi računi povezani s firmom će biti odspojeni.')) return

    try {
      await deleteCompany(id)
      await fetchData()
    } catch (error) {
      console.error('Error deleting company:', error)
      alert('Greška prilikom brisanja firme')
    }
  }

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
      alert('Greška pri učitavanju detalja firme')
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

  const handleBankAccountChange = (index: number, field: 'bank_name' | 'current_balance', value: string | number) => {
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

  const handleFormDataChange = (field: keyof typeof formData, value: any) => {
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
