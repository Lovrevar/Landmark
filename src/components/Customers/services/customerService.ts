import { supabase, Customer } from '../../../lib/supabase'
import { CustomerWithApartments, CustomerCategory, CustomerCounts } from '../types/customerTypes'

export const customerService = {
  async fetchCustomers(category: CustomerCategory): Promise<CustomerWithApartments[]> {
    const { data: customersData, error } = await supabase
      .from('customers')
      .select('*')
      .eq('status', category)
      .order('last_contact_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    const customersWithDetails = await Promise.all(
      (customersData || []).map(async (customer) => {
        if (customer.status === 'buyer') {
          const { data: salesData } = await supabase
            .from('sales')
            .select('apartment_id, sale_price, sale_date')
            .eq('customer_id', customer.id)

          if (salesData && salesData.length > 0) {
            const apartments = await Promise.all(
              salesData.map(async (sale) => {
                const { data: aptData } = await supabase
                  .from('apartments')
                  .select('id, number, floor, size_m2, project_id')
                  .eq('id', sale.apartment_id)
                  .maybeSingle()

                if (aptData) {
                  const { data: projData } = await supabase
                    .from('projects')
                    .select('name')
                    .eq('id', aptData.project_id)
                    .maybeSingle()

                  return {
                    id: aptData.id,
                    number: aptData.number,
                    floor: aptData.floor,
                    size_m2: aptData.size_m2,
                    project_name: projData?.name || 'Unknown',
                    sale_price: sale.sale_price,
                    sale_date: sale.sale_date
                  }
                }
                return null
              })
            )

            return {
              ...customer,
              apartments: apartments.filter(apt => apt !== null) as any[]
            }
          }
        }

        return customer
      })
    )

    return customersWithDetails
  },

  async fetchCustomerCounts(): Promise<CustomerCounts> {
    const { data, error } = await supabase
      .from('customers')
      .select('status')

    if (error) throw error

    const counts: CustomerCounts = {
      interested: 0,
      hot_lead: 0,
      negotiating: 0,
      buyer: 0,
      backed_out: 0
    }

    data?.forEach((customer) => {
      if (customer.status in counts) {
        counts[customer.status as CustomerCategory]++
      }
    })

    return counts
  },

  async createCustomer(customerData: Partial<Customer>): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .insert([customerData])

    if (error) throw error
  },

  async updateCustomer(id: string, customerData: Partial<Customer>): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update(customerData)
      .eq('id', id)

    if (error) throw error
  },

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async updateLastContact(customerId: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ last_contact_date: new Date().toISOString() })
      .eq('id', customerId)

    if (error) throw error
  }
}
