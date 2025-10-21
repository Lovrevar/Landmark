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
      status: 'Available'
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

export const addPaymentToApartment = async (
  apartmentId: string,
  customerId: string,
  projectId: string,
  saleId: string | null,
  amount: number,
  paymentDate: string,
  paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other',
  notes: string,
  garageId: string | null = null,
  storageId: string | null = null
) => {
  const { data: payment, error: paymentError } = await supabase
    .from('apartment_payments')
    .insert({
      apartment_id: apartmentId,
      customer_id: customerId,
      project_id: projectId,
      sale_id: saleId,
      amount,
      payment_date: paymentDate,
      payment_type: paymentType,
      notes,
      garage_id: garageId,
      storage_id: storageId
    })
    .select()
    .single()

  if (paymentError) throw paymentError

  if (saleId) {
    const { data: allPayments } = await supabase
      .from('apartment_payments')
      .select('amount')
      .eq('sale_id', saleId)

    const totalPaid = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

    await supabase
      .from('sales')
      .update({
        total_paid: totalPaid,
        remaining_amount: (await supabase
          .from('sales')
          .select('sale_price')
          .eq('id', saleId)
          .single()).data?.sale_price - totalPaid
      })
      .eq('id', saleId)
  }

  return payment
}

export const fetchApartmentPayments = async (apartmentId: string) => {
  const { data, error } = await supabase
    .from('apartment_payments')
    .select(`
      *,
      customers:customer_id (
        name,
        surname,
        email
      )
    `)
    .eq('apartment_id', apartmentId)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return data.map(payment => ({
    ...payment,
    customer_name: payment.customers?.name || 'Unknown',
    customer_surname: payment.customers?.surname || '',
    customer_email: payment.customers?.email || 'Unknown'
  }))
}

export const updatePayment = async (
  paymentId: string,
  amount: number,
  paymentDate: string,
  paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other',
  notes: string,
  saleId: string | null
) => {
  const { error: updateError } = await supabase
    .from('apartment_payments')
    .update({
      amount,
      payment_date: paymentDate,
      payment_type: paymentType,
      notes
    })
    .eq('id', paymentId)

  if (updateError) throw updateError

  if (saleId) {
    const { data: allPayments } = await supabase
      .from('apartment_payments')
      .select('amount')
      .eq('sale_id', saleId)

    const totalPaid = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

    await supabase
      .from('sales')
      .update({
        total_paid: totalPaid,
        remaining_amount: (await supabase
          .from('sales')
          .select('sale_price')
          .eq('id', saleId)
          .single()).data?.sale_price - totalPaid
      })
      .eq('id', saleId)
  }
}

export const deletePayment = async (paymentId: string, saleId: string | null, amount: number) => {
  const { error: deleteError } = await supabase
    .from('apartment_payments')
    .delete()
    .eq('id', paymentId)

  if (deleteError) throw deleteError

  if (saleId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('total_paid, sale_price')
      .eq('id', saleId)
      .single()

    if (sale) {
      const newTotal = Math.max(0, (sale.total_paid || 0) - amount)
      await supabase
        .from('sales')
        .update({
          total_paid: newTotal,
          remaining_amount: sale.sale_price - newTotal
        })
        .eq('id', saleId)
    }
  }
}
