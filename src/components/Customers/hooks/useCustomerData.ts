import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { CustomerCategory, CustomerWithApartments, CustomerCounts } from '../types/customerTypes'

export const useCustomerData = (activeCategory: CustomerCategory) => {
  const [customers, setCustomers] = useState<CustomerWithApartments[]>([])
  const [counts, setCounts] = useState<CustomerCounts>({
    interested: 0,
    reserved: 0,
    contract: 0,
    sold: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('category', activeCategory)
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('customer_id, apartment_id')

      if (salesError) throw salesError

      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')

      if (apartmentsError) throw apartmentsError

      const enrichedCustomers = (customersData || []).map(customer => {
        const customerSales = salesData?.filter(s => s.customer_id === customer.id) || []
        const customerApartments = customerSales
          .map(sale => apartmentsData?.find(apt => apt.id === sale.apartment_id))
          .filter(Boolean)

        return {
          ...customer,
          apartments: customerApartments as any[],
          apartment_count: customerApartments.length
        }
      })

      setCustomers(enrichedCustomers)

      const allCustomers = await supabase.from('customers').select('category')
      const countsData = (allCustomers.data || []).reduce((acc, c) => {
        acc[c.category as CustomerCategory] = (acc[c.category as CustomerCategory] || 0) + 1
        return acc
      }, {} as CustomerCounts)

      setCounts({
        interested: countsData.interested || 0,
        reserved: countsData.reserved || 0,
        contract: countsData.contract || 0,
        sold: countsData.sold || 0
      })
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [activeCategory])

  const saveCustomer = async (customerData: Partial<CustomerWithApartments>) => {
    try {
      if (customerData.id) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customerData.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('customers')
          .insert(customerData)

        if (error) throw error
      }

      await fetchCustomers()
    } catch (error) {
      console.error('Error saving customer:', error)
      throw error
    }
  }

  const deleteCustomer = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)

      if (error) throw error

      await fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      throw error
    }
  }

  const updateLastContact = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ last_contact: new Date().toISOString() })
        .eq('id', customerId)

      if (error) throw error

      await fetchCustomers()
    } catch (error) {
      console.error('Error updating last contact:', error)
      throw error
    }
  }

  return {
    customers,
    counts,
    loading,
    saveCustomer,
    deleteCustomer,
    updateLastContact,
    refetch: fetchCustomers
  }
}
