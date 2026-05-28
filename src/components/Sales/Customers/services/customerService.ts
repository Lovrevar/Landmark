import { supabase, Customer } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { CustomerWithApartments, CustomerCategory, CustomerCounts } from '../types'

export const customerService = {
  async fetchCustomers(category: CustomerCategory | null): Promise<CustomerWithApartments[]> {
    let query = supabase
      .from('customers')
      .select('*')
      .order('last_contact_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (category !== null) {
      query = query.eq('status', category)
    }

    const { data: customersData, error } = await query

    if (error) throw error

    const customers = customersData || []
    const buyerIds = customers.filter(c => c.status === 'buyer').map(c => c.id)

    if (buyerIds.length === 0) {
      return customers
    }

    const { data: salesData } = await supabase
      .from('sales')
      .select('apartment_id, sale_price, sale_date, down_payment, total_paid, customer_id')
      .in('customer_id', buyerIds)

    const sales = (salesData || []).filter(s => s.apartment_id)
    const apartmentIds = [...new Set(sales.map(s => s.apartment_id as string))]

    if (apartmentIds.length === 0) {
      return customers.map(c => c.status === 'buyer' ? { ...c, apartments: [] } : c)
    }

    const [apartmentsRes, garageLinksRes, repoLinksRes, invoicesRes] = await Promise.all([
      supabase
        .from('apartments')
        .select('id, number, floor, size_m2, price, project_id')
        .in('id', apartmentIds),
      supabase
        .from('apartment_garages')
        .select('apartment_id, garage_id')
        .in('apartment_id', apartmentIds),
      supabase
        .from('apartment_repositories')
        .select('apartment_id, repository_id')
        .in('apartment_id', apartmentIds),
      supabase
        .from('accounting_invoices')
        .select('id, apartment_id, customer_id')
        .in('apartment_id', apartmentIds)
        .in('customer_id', buyerIds)
        .eq('invoice_type', 'OUTGOING_SALES'),
    ])

    const apartments = apartmentsRes.data || []
    const garageLinks = garageLinksRes.data || []
    const repoLinks = repoLinksRes.data || []
    const invoices = invoicesRes.data || []

    const projectIds = [...new Set(apartments.map(a => a.project_id).filter(Boolean))]
    const garageIds = garageLinks.map(l => l.garage_id).filter(Boolean) as string[]
    const repoIds = repoLinks.map(l => l.repository_id).filter(Boolean) as string[]
    const invoiceIds = invoices.map(i => i.id)

    const [projectsRes, garagesRes, reposRes, paymentsRes] = await Promise.all([
      projectIds.length > 0
        ? supabase.from('projects').select('id, name').in('id', projectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      garageIds.length > 0
        ? supabase.from('garages').select('id, number, price').in('id', garageIds)
        : Promise.resolve({ data: [] as { id: string; number: string; price: number }[] }),
      repoIds.length > 0
        ? supabase.from('repositories').select('id, number, price').in('id', repoIds)
        : Promise.resolve({ data: [] as { id: string; number: string; price: number }[] }),
      invoiceIds.length > 0
        ? supabase.from('accounting_payments').select('amount, invoice_id').in('invoice_id', invoiceIds)
        : Promise.resolve({ data: [] as { amount: string; invoice_id: string }[] }),
    ])

    const projects = projectsRes.data || []
    const garages = garagesRes.data || []
    const repos = reposRes.data || []
    const payments = paymentsRes.data || []

    const apartmentById = new Map(apartments.map(a => [a.id, a]))
    const projectById = new Map(projects.map(p => [p.id, p]))
    const garageById = new Map(garages.map(g => [g.id, g]))
    const repoById = new Map(repos.map(r => [r.id, r]))

    const garageByApartment = new Map<string, typeof garages[number] | null>()
    for (const link of garageLinks) {
      if (link.garage_id) garageByApartment.set(link.apartment_id, garageById.get(link.garage_id) || null)
    }
    const repoByApartment = new Map<string, typeof repos[number] | null>()
    for (const link of repoLinks) {
      if (link.repository_id) repoByApartment.set(link.apartment_id, repoById.get(link.repository_id) || null)
    }

    const paidByInvoice = new Map<string, number>()
    for (const p of payments) {
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) || 0) + parseFloat(p.amount))
    }

    const paidByCustomerApt = new Map<string, number>()
    for (const inv of invoices) {
      const key = `${inv.customer_id}|${inv.apartment_id}`
      const paid = paidByInvoice.get(inv.id) || 0
      paidByCustomerApt.set(key, (paidByCustomerApt.get(key) || 0) + paid)
    }

    const salesByCustomer = new Map<string, typeof sales>()
    for (const sale of sales) {
      const arr = salesByCustomer.get(sale.customer_id) || []
      arr.push(sale)
      salesByCustomer.set(sale.customer_id, arr)
    }

    return customers.map(customer => {
      if (customer.status !== 'buyer') return customer

      const customerSales = salesByCustomer.get(customer.id) || []
      const purchasedUnits: Record<string, unknown>[] = []

      for (const sale of customerSales) {
        const apt = apartmentById.get(sale.apartment_id as string)
        if (!apt) continue
        const proj = projectById.get(apt.project_id)
        purchasedUnits.push({
          type: 'apartment',
          id: apt.id,
          number: apt.number,
          floor: apt.floor,
          size_m2: apt.size_m2,
          price: apt.price,
          project_name: proj?.name || 'Unknown',
          project_id: apt.project_id,
          sale_price: sale.sale_price,
          sale_date: sale.sale_date,
          down_payment: sale.down_payment,
          total_paid: paidByCustomerApt.get(`${customer.id}|${apt.id}`) || 0,
          garage: garageByApartment.get(apt.id) || null,
          repository: repoByApartment.get(apt.id) || null,
        })
      }

      return customerSales.length > 0 ? { ...customer, apartments: purchasedUnits } : customer
    })
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
    const { data: inserted, error } = await supabase
      .from('customers')
      .insert([customerData])
      .select('id')
      .maybeSingle()

    if (error) throw error

    logActivity({ action: 'customer.create', entity: 'customer', entityId: inserted?.id ?? null, metadata: { severity: 'low', entity_name: `${customerData.name || ''} ${customerData.surname || ''}`.trim() } })
  },

  async updateCustomer(id: string, customerData: Partial<Customer>): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update(customerData)
      .eq('id', id)

    if (error) throw error

    logActivity({ action: 'customer.update', entity: 'customer', entityId: id, metadata: { severity: 'low', changed_fields: Object.keys(customerData) } })
  },

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) throw error

    logActivity({ action: 'customer.delete', entity: 'customer', entityId: id, metadata: { severity: 'medium' } })
  },

  async updateLastContact(customerId: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ last_contact_date: new Date().toISOString() })
      .eq('id', customerId)

    if (error) throw error
  }
}
