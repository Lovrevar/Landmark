import { supabase } from '../../../lib/supabase'
import { Customer, CustomerStats } from '../types/customerTypes'

export const fetchCustomers = async () => {
  const { data: customersData, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  if (customersError) throw customersError

  return customersData as Customer[]
}

export const fetchCustomerInvoices = async (customerId: string) => {
  const { data: invoicesData } = await supabase
    .from('accounting_invoices')
    .select(`
      id,
      invoice_number,
      invoice_type,
      total_amount,
      paid_amount,
      remaining_amount,
      status,
      issue_date,
      company:company_id (name)
    `)
    .eq('customer_id', customerId)
    .order('issue_date', { ascending: false })

  return invoicesData || []
}

export const fetchCustomerProperties = async (customerId: string) => {
  const { data: propertyData } = await supabase
    .from('sales')
    .select(`
      apartment_id,
      apartments!inner (
        price,
        garage_id,
        repository_id,
        garages (price),
        repositories (price)
      )
    `)
    .eq('customer_id', customerId)

  return propertyData || []
}

export const buildCustomerStats = async (customer: Customer): Promise<CustomerStats> => {
  const invoices = await fetchCustomerInvoices(customer.id)

  const totalAmount = invoices.reduce((sum, i) => sum + i.total_amount, 0)
  const totalPaid = invoices.reduce((sum, i) => sum + i.paid_amount, 0)
  const totalUnpaid = invoices.reduce((sum, i) => sum + i.remaining_amount, 0)

  const propertyData = await fetchCustomerProperties(customer.id)

  let propertyPrice = 0
  let totalApartments = 0
  if (propertyData && propertyData.length > 0) {
    totalApartments = propertyData.length
    propertyData.forEach((sale) => {
      if (sale.apartments) {
        const apt = sale.apartments
        propertyPrice += Number(apt.price || 0)
        if (apt.garages) {
          propertyPrice += Number(apt.garages.price || 0)
        }
        if (apt.repositories) {
          propertyPrice += Number(apt.repositories.price || 0)
        }
      }
    })
  }

  return {
    id: customer.id,
    name: customer.name,
    surname: customer.surname,
    full_name: `${customer.name} ${customer.surname}`.trim(),
    email: customer.email,
    phone: customer.phone,
    total_invoices: invoices.length,
    total_amount: totalAmount,
    total_paid: totalPaid,
    total_unpaid: totalUnpaid,
    property_price: propertyPrice,
    total_apartments: totalApartments,
    invoices: invoices
  }
}
