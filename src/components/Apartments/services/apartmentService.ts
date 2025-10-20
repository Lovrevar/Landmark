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
  amount: number,
  paymentDate: string,
  notes: string,
  userId: string
) => {
  const { data: payment, error: paymentError } = await supabase
    .from('sales_payments')
    .insert({
      apartment_id: apartmentId,
      amount,
      payment_date: paymentDate,
      notes,
      created_by: userId
    })
    .select()
    .single()

  if (paymentError) throw paymentError

  const { data: apartment } = await supabase
    .from('apartments')
    .select('*')
    .eq('id', apartmentId)
    .single()

  if (apartment) {
    const { data: allPayments } = await supabase
      .from('sales_payments')
      .select('amount')
      .eq('apartment_id', apartmentId)

    const totalPaid = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

    await supabase
      .from('apartments')
      .update({ total_paid: totalPaid })
      .eq('id', apartmentId)
  }

  return payment
}

export const fetchApartmentPayments = async (apartmentId: string) => {
  const { data, error } = await supabase
    .from('sales_payments')
    .select(`
      *,
      users:created_by (email)
    `)
    .eq('apartment_id', apartmentId)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return data.map(payment => ({
    ...payment,
    user_email: payment.users?.email || 'Unknown'
  }))
}

export const updatePayment = async (
  paymentId: string,
  amount: number,
  paymentDate: string,
  notes: string,
  apartmentId: string,
  oldAmount: number
) => {
  const { error: updateError } = await supabase
    .from('sales_payments')
    .update({
      amount,
      payment_date: paymentDate,
      notes
    })
    .eq('id', paymentId)

  if (updateError) throw updateError

  const { data: allPayments } = await supabase
    .from('sales_payments')
    .select('amount')
    .eq('apartment_id', apartmentId)

  const totalPaid = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

  await supabase
    .from('apartments')
    .update({ total_paid: totalPaid })
    .eq('id', apartmentId)
}

export const deletePayment = async (paymentId: string, apartmentId: string, amount: number) => {
  const { error: deleteError } = await supabase
    .from('sales_payments')
    .delete()
    .eq('id', paymentId)

  if (deleteError) throw deleteError

  const { data: apartment } = await supabase
    .from('apartments')
    .select('total_paid')
    .eq('id', apartmentId)
    .single()

  if (apartment) {
    const newTotal = Math.max(0, (apartment.total_paid || 0) - amount)
    await supabase
      .from('apartments')
      .update({ total_paid: newTotal })
      .eq('id', apartmentId)
  }
}
