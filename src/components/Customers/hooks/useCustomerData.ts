import { useState, useEffect } from 'react'
import { customerService } from '../services/customerService'
import { CustomerWithApartments, CustomerCategory, CustomerCounts } from '../types/customerTypes'
import { Customer } from '../../../lib/supabase'

export const useCustomerData = (activeCategory: CustomerCategory) => {
  const [customers, setCustomers] = useState<CustomerWithApartments[]>([])
  const [counts, setCounts] = useState<CustomerCounts>({
    interested: 0,
    hot_lead: 0,
    negotiating: 0,
    buyer: 0,
    backed_out: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = await customerService.fetchCustomers(activeCategory)
      setCustomers(data)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCounts = async () => {
    try {
      const countsData = await customerService.fetchCustomerCounts()
      setCounts(countsData)
    } catch (error) {
      console.error('Error fetching customer counts:', error)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [activeCategory])

  useEffect(() => {
    fetchCounts()
  }, [])

  const saveCustomer = async (customerData: Partial<Customer>, editingId?: string) => {
    try {
      if (editingId) {
        await customerService.updateCustomer(editingId, customerData)
      } else {
        await customerService.createCustomer(customerData)
      }
      await fetchCustomers()
      await fetchCounts()
    } catch (error) {
      console.error('Error saving customer:', error)
      throw error
    }
  }

  const deleteCustomer = async (id: string) => {
    try {
      await customerService.deleteCustomer(id)
      await fetchCustomers()
      await fetchCounts()
    } catch (error) {
      console.error('Error deleting customer:', error)
      throw error
    }
  }

  const updateLastContact = async (customerId: string) => {
    try {
      await customerService.updateLastContact(customerId)
      await fetchCustomers()
    } catch (error) {
      console.error('Error updating contact date:', error)
      throw error
    }
  }

  return {
    customers,
    counts,
    loading,
    saveCustomer,
    deleteCustomer,
    updateLastContact
  }
}
