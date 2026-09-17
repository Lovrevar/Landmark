import { useState, useEffect } from 'react'
import { CustomerStats, TotalStats } from '../types'
import { fetchCustomers, buildCustomerStats } from '../services/customerService'
import { lockBodyScroll, unlockBodyScroll } from '../../../../hooks/useModalOverflow'
import { toLoadError } from '../../services/loadError'

export const useAccountingCustomers = () => {
  const [customers, setCustomers] = useState<CustomerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  /** True when some customers loaded but others failed, so the totals understate the truth. */
  const [partial, setPartial] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStats | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    setPartial(false)
    try {
      const customersData = await fetchCustomers()

      // One customer's invoice query failing used to reject the whole `Promise.all`, emptying
      // the table and every stat card. Keep the customers that did load, and say so.
      const settled = await Promise.allSettled(
        customersData.map(customer => buildCustomerStats(customer))
      )

      const loaded = settled
        .filter((r): r is PromiseFulfilledResult<CustomerStats> => r.status === 'fulfilled')
        .map(r => r.value)
      const firstRejection = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')

      setCustomers(loaded)

      if (firstRejection) {
        console.error('Error fetching customers:', firstRejection.reason)
        setError(toLoadError(firstRejection.reason))
        setPartial(loaded.length > 0)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      setError(toLoadError(error))
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const isIncomeInvoice = (invoiceType: string) => {
    return invoiceType.startsWith('OUTGOING_')
  }

  const handleOpenDetails = (customer: CustomerStats) => {
    setSelectedCustomer(customer)
    lockBodyScroll()
    setShowDetailsModal(true)
  }

  const handleCloseDetails = () => {
    unlockBodyScroll()
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
    error,
    partial,
    refetch: fetchData,
    dismissError: () => setError(null),
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
