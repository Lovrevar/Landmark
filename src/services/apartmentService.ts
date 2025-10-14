import { supabase, Apartment, Sale } from '../lib/supabase'

export interface ApartmentWithSale extends Apartment {
  sale_info?: {
    sale_price: number
    payment_method: string
    down_payment: number
    total_paid: number
    remaining_amount: number
    monthly_payment: number
    sale_date: string
    contract_signed: boolean
    buyer_name: string
    buyer_email: string
    buyer_phone: string
  }
}

export async function getApartmentsWithSales(projectId?: string): Promise<ApartmentWithSale[]> {
  let apartmentsQuery = supabase
    .from('apartments')
    .select('*')
    .order('floor')
    .order('number')

  if (projectId) {
    apartmentsQuery = apartmentsQuery.eq('project_id', projectId)
  }

  const { data: apartmentsData, error: apartmentsError } = await apartmentsQuery
  if (apartmentsError) throw apartmentsError

  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select(`
      *,
      customers(name, surname, email, phone)
    `)

  if (salesError) throw salesError

  return (apartmentsData || []).map(apartment => {
    const sale = (salesData || []).find(s => s.apartment_id === apartment.id)
    if (sale && apartment.status === 'Sold') {
      return {
        ...apartment,
        sale_info: {
          sale_price: sale.sale_price,
          payment_method: sale.payment_method,
          down_payment: sale.down_payment,
          total_paid: sale.total_paid,
          remaining_amount: sale.remaining_amount,
          monthly_payment: sale.monthly_payment,
          sale_date: sale.sale_date,
          contract_signed: sale.contract_signed,
          buyer_name: sale.customers ? `${sale.customers.name} ${sale.customers.surname}` : apartment.buyer_name || 'Unknown',
          buyer_email: sale.customers?.email || '',
          buyer_phone: sale.customers?.phone || ''
        }
      }
    }
    return apartment
  })
}

export async function bulkUpdateApartmentPrices(apartmentIds: string[], pricePerSqm: number) {
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, size_m2')
    .in('id', apartmentIds)

  if (!apartments) throw new Error('Failed to fetch apartments')

  const updates = apartments.map(apt => ({
    id: apt.id,
    price: apt.size_m2 * pricePerSqm
  }))

  for (const update of updates) {
    await supabase
      .from('apartments')
      .update({ price: update.price })
      .eq('id', update.id)
  }
}
