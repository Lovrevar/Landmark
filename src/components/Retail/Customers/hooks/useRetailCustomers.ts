import { useState, useEffect, useCallback } from 'react'
import type { CustomerWithStats, CustomerDetailView, CustomerFormData } from '../services/retailCustomerService'
import {
  fetchCustomersWithStats,
  fetchCustomerContracts,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../services/retailCustomerService'

const EMPTY_FORM: CustomerFormData = {
  name: '',
  contact_phone: '',
  contact_email: '',
  oib: '',
  address: '',
}

export function useRetailCustomers() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetailView | null>(null)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(EMPTY_FORM)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      setCustomers(await fetchCustomersWithStats())
    } catch (err) {
      console.error('Error fetching customers:', err)
      alert('Greška pri učitavanju kupaca')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.oib && c.oib.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.contact_phone && c.contact_phone.includes(searchTerm)),
  )

  const totalStats = {
    total_customers: customers.length,
    total_area: customers.reduce((sum, c) => sum + c.total_purchased_area, 0),
    total_revenue: customers.reduce((sum, c) => sum + c.total_spent, 0),
    total_remaining: customers.reduce((sum, c) => sum + c.total_remaining, 0),
  }

  const openFormModal = (customer?: CustomerWithStats) => {
    if (customer) {
      setEditingCustomerId(customer.id)
      setFormData({
        name: customer.name,
        contact_phone: customer.contact_phone || '',
        contact_email: customer.contact_email || '',
        oib: customer.oib || '',
        address: customer.address || '',
      })
    } else {
      setEditingCustomerId(null)
      setFormData(EMPTY_FORM)
    }
    document.body.style.overflow = 'hidden'
    setShowFormModal(true)
  }

  const closeFormModal = () => {
    document.body.style.overflow = 'unset'
    setShowFormModal(false)
    setEditingCustomerId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCustomerId) {
        await updateCustomer(editingCustomerId, formData)
      } else {
        await createCustomer(formData)
      }
      await loadCustomers()
      closeFormModal()
    } catch (err) {
      console.error('Error saving customer:', err)
      alert('Greška pri spremanju kupca')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovog kupca?')) return
    try {
      await deleteCustomer(id)
      await loadCustomers()
    } catch (err) {
      console.error('Error deleting customer:', err)
      alert('Greška pri brisanju kupca. Provjerite ima li kupac povezane prodaje.')
    }
  }

  const handleViewDetails = async (customer: CustomerWithStats) => {
    try {
      const sales = await fetchCustomerContracts(customer.id)
      setSelectedCustomer({ ...customer, sales })
      document.body.style.overflow = 'hidden'
      setShowDetailsModal(true)
    } catch (err) {
      console.error('Error loading customer details:', err)
      alert('Greška pri učitavanju detalja')
    }
  }

  const closeDetailsModal = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedCustomer(null)
  }

  return {
    loading,
    searchTerm,
    setSearchTerm,
    filteredCustomers,
    totalStats,
    showFormModal,
    showDetailsModal,
    selectedCustomer,
    editingCustomerId,
    formData,
    setFormData,
    openFormModal,
    closeFormModal,
    handleSubmit,
    handleDelete,
    handleViewDetails,
    closeDetailsModal,
  }
}
