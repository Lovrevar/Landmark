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
            .select('apartment_id, sale_price, sale_date, down_payment, total_paid')
            .eq('customer_id', customer.id)

          if (salesData && salesData.length > 0) {
            const purchasedUnits: any[] = []

            for (const sale of salesData) {
              if (sale.apartment_id) {
                const { data: aptData } = await supabase
                  .from('apartments')
                  .select('id, number, floor, size_m2, price, project_id, garage_id, repository_id')
                  .eq('id', sale.apartment_id)
                  .maybeSingle()

                if (aptData) {
                  const { data: projData } = await supabase
                    .from('projects')
                    .select('name')
                    .eq('id', aptData.project_id)
                    .maybeSingle()

                  let garageData = null
                  let repositoryData = null

                  if (aptData.garage_id) {
                    const { data: gData } = await supabase
                      .from('garages')
                      .select('id, number, price')
                      .eq('id', aptData.garage_id)
                      .maybeSingle()
                    garageData = gData
                  }

                  if (aptData.repository_id) {
                    const { data: rData } = await supabase
                      .from('repositories')
                      .select('id, number, price')
                      .eq('id', aptData.repository_id)
                      .maybeSingle()
                    repositoryData = rData
                  }

                  // Calculate actual total paid from accounting_payments
                  const { data: invoicesData } = await supabase
                    .from('accounting_invoices')
                    .select('id')
                    .eq('apartment_id', aptData.id)
                    .eq('customer_id', customer.id)
                    .eq('invoice_type', 'OUTGOING_SALES')

                  let actualTotalPaid = 0
                  if (invoicesData && invoicesData.length > 0) {
                    const invoiceIds = invoicesData.map(inv => inv.id)
                    const { data: paymentsData } = await supabase
                      .from('accounting_payments')
                      .select('amount')
                      .in('invoice_id', invoiceIds)

                    actualTotalPaid = paymentsData?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0
                  }

                  purchasedUnits.push({
                    type: 'apartment',
                    id: aptData.id,
                    number: aptData.number,
                    floor: aptData.floor,
                    size_m2: aptData.size_m2,
                    price: aptData.price,
                    project_name: projData?.name || 'Unknown',
                    project_id: aptData.project_id,
                    sale_price: sale.sale_price,
                    sale_date: sale.sale_date,
                    down_payment: sale.down_payment,
                    total_paid: actualTotalPaid,
                    garage: garageData,
                    repository: repositoryData
                  })
                }
              }
            }

            return {
              ...customer,
              apartments: purchasedUnits
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
