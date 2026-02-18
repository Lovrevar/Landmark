import { supabase } from '../../../lib/supabase'
import { ApartmentFormData, BulkApartmentData } from '../types/apartmentTypes'

export const createSingleApartment = async (data: ApartmentFormData) => {
  const { data: apartment, error } = await supabase
    .from('apartments')
    .insert({
      project_id: data.project_id,
      building_id: data.building_id,
      number: data.number,
      floor: data.floor,
      size_m2: data.size_m2,
      price: data.price,
      status: 'Available',
      ulaz: data.ulaz || null,
      tip_stana: data.tip_stana || null,
      sobnost: data.sobnost ?? null,
      povrsina_otvoreno: data.povrsina_otvoreno ?? null,
      povrsina_ot_sa_koef: data.povrsina_ot_sa_koef ?? null
    })
    .select()
    .single()

  if (error) throw error
  return apartment
}

export const createBulkApartments = async (data: BulkApartmentData) => {
  const apartments = []

  for (let i = 0; i < data.quantity; i++) {
    apartments.push({
      project_id: data.project_id,
      building_id: data.building_id,
      number: `A${data.start_number + i}`,
      floor: data.floor,
      size_m2: data.size_m2,
      price: data.price,
      status: 'Available'
    })
  }

  const { data: created, error } = await supabase
    .from('apartments')
    .insert(apartments)
    .select()

  if (error) throw error
  return created
}

export const updateApartment = async (id: string, updates: Partial<ApartmentFormData>) => {
  const { data, error } = await supabase
    .from('apartments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteApartment = async (id: string) => {
  const { error } = await supabase
    .from('apartments')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// DEPRECATED: Payment creation moved to Accounting module
// Apartments only display payments, creation happens in Accounting → Invoices
export const addPaymentToApartment = async () => {
  throw new Error('Payment creation moved to Accounting module. Please use Accounting → Invoices.')
}

export const fetchApartmentPayments = async (apartmentId: string) => {
  const { data, error } = await supabase
    .from('accounting_payments')
    .select(`
      *,
      invoice:accounting_invoices!inner(
        id,
        invoice_number,
        customer_id,
        apartment_id,
        category,
        customers:customer_id (
          name,
          surname,
          email
        )
      )
    `)
    .eq('invoice.apartment_id', apartmentId)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return data.map(payment => ({
    ...payment,
    payment_type: payment.invoice.category,
    customer_name: payment.invoice.customers?.name || 'Unknown',
    customer_surname: payment.invoice.customers?.surname || '',
    customer_email: payment.invoice.customers?.email || 'Unknown'
  }))
}

// DEPRECATED: Payment updates moved to Accounting module
export const updatePayment = async () => {
  throw new Error('Payment updates moved to Accounting module. Please use Accounting → Payments.')
}

// DEPRECATED: Payment deletion moved to Accounting module
export const deletePayment = async () => {
  throw new Error('Payment deletion moved to Accounting module. Please use Accounting → Payments.')
}

// DEPRECATED: Multiple payments creation moved to Accounting module
export const addMultiplePayments = async () => {
  throw new Error('Multiple payments creation moved to Accounting module. Please use Accounting → Invoices.')
}
