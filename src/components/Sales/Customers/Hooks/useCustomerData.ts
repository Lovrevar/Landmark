import { useState, useEffect } from 'react'
import { customerService } from '../Services/customerService'
import { cache } from '../Services/customerCache'
import { CustomerWithApartments, CustomerCategory, CustomerCounts } from '../types'
import { Customer } from '../../../../lib/supabase'

export const useCustomerData = (activeCategory: CustomerCategory | null) => {
  const [customers, setCustomers] = useState<CustomerWithApartments[]>([])
  const [counts, setCounts] = useState<CustomerCounts>({
    interested: 0,
    hot_lead: 0,
    negotiating: 0,
    buyer: 0,
    backed_out: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchCustomers = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cache.getCustomers(activeCategory)
      if (cached) {
        setCustomers(cached)
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      const data = await customerService.fetchCustomers(activeCategory)
      cache.setCustomers(activeCategory, data)
      setCustomers(data)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCounts = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cache.getCounts()
      if (cached) {
        setCounts(cached)
        return
      }
    }

    try {
      const countsData = await customerService.fetchCustomerCounts()
      cache.setCounts(countsData)
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
      cache.invalidate()
      await fetchCustomers(true)
      await fetchCounts(true)
    } catch (error) {
      throw error
    }
  }

  const deleteCustomer = async (id: string) => {
    try {
      await customerService.deleteCustomer(id)
      cache.invalidate()
      await fetchCustomers(true)
      await fetchCounts(true)
    } catch (error) {
      console.error('Error deleting customer:', error)
      throw error
    }
  }

  const updateLastContact = async (customerId: string) => {
    try {
      await customerService.updateLastContact(customerId)
      cache.invalidate()
      await fetchCustomers(true)
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
