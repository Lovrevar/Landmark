import { useState, useEffect, useCallback } from 'react'
import { customerService } from '../services/customerService'
import { cache } from '../services/customerCache'
import { CustomerWithApartments, CustomerCategory, CustomerCounts, ProjectOption } from '../types'
import { Customer } from '../../../../lib/supabase'

export const useCustomerData = (activeCategory: CustomerCategory | null) => {
  const [customers, setCustomers] = useState<CustomerWithApartments[]>([])
  const [counts, setCounts] = useState<CustomerCounts>({
    interested: 0,
    lead: 0,
    buyer: 0
  })
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  // A failed fetch left `customers` empty, which the grid rendered as "no customers".
  const [error, setError] = useState<Error | null>(null)

  const fetchCustomers = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cache.getCustomers(activeCategory)
      if (cached) {
        setCustomers(cached)
        setError(null)
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      const data = await customerService.fetchCustomers(activeCategory)
      cache.setCustomers(activeCategory, data)
      setCustomers(data)
    } catch (err) {
      console.error('Error fetching customers:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [activeCategory])

  const fetchCounts = useCallback(async (forceRefresh = false) => {
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
    } catch (err) {
      // Counts drive the category tabs; zeros there are as misleading as an empty list, so
      // the failure joins the page's error rather than staying in the console.
      console.error('Error fetching customer counts:', err)
      setError(prev => prev ?? (err instanceof Error ? err : new Error(String(err))))
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Project list backs both the form's "interested in" select and the page filter.
  // Small and slow-changing, so it is fetched once per mount rather than cached.
  useEffect(() => {
    customerService.fetchProjectOptions()
      .then(setProjects)
      .catch(error => console.error('Error fetching projects:', error))
  }, [])

  const saveCustomer = async (customerData: Partial<Customer>, editingId?: string) => {
    if (editingId) {
      await customerService.updateCustomer(editingId, customerData)
    } else {
      await customerService.createCustomer(customerData)
    }
    cache.invalidate()
    await fetchCustomers(true)
    await fetchCounts(true)
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

  const refetch = useCallback(async () => {
    cache.invalidate()
    await Promise.all([fetchCustomers(true), fetchCounts(true)])
  }, [fetchCustomers, fetchCounts])

  const dismissError = useCallback(() => setError(null), [])

  return {
    customers,
    counts,
    projects,
    loading,
    error,
    refetch,
    dismissError,
    saveCustomer,
    deleteCustomer,
    updateLastContact
  }
}
