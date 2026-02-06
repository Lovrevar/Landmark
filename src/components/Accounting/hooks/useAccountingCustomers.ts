import { useState, useEffect } from 'react'
import { CustomerStats, TotalStats } from '../types/customerTypes'
import { fetchCustomers, buildCustomerStats } from '../services/customerService'

export const useAccountingCustomers = () => {
  const [customers, setCustomers] = useState<CustomerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStats | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const customersData = await fetchCustomers()

      const customersWithStats = await Promise.all(
        customersData.map(customer => buildCustomerStats(customer))
      )

      setCustomers(customersWithStats)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const isIncomeInvoice = (invoiceType: string) => {
    return invoiceType === 'INCOMING_INVESTMENT' || invoiceType === 'OUTGOING_SALES'
  }

  const handleOpenDetails = (customer: CustomerStats) => {
    setSelectedCustomer(customer)
    document.body.style.overflow = 'hidden'
    setShowDetailsModal(true)
  }

  const handleCloseDetails = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedCustomer(null)
  }

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  )

  const totalStats: TotalStats = {
    total_invoices: customers.reduce((sum, c) => sum + c.total_invoices, 0),
    total_property_value: customers.reduce((sum, c) => sum + c.property_price, 0),
    total_paid: customers.reduce((sum, c) => sum + c.total_paid, 0),
    total_debt: customers.reduce((sum, c) => sum + (c.property_price - c.total_paid), 0)
  }

  return {
    customers,
    loading,
    searchTerm,
    setSearchTerm,
    showDetailsModal,
    selectedCustomer,
    isIncomeInvoice,
    handleOpenDetails,
    handleCloseDetails,
    filteredCustomers,
    totalStats
  }
}
