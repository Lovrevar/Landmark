import { supabase } from './supabaseClient'
import { UnitType } from '../types'

export async function listSales() {
  return supabase
    .from('sales')
    .select(`
      *,
      customers(name, surname, email, phone)
    `)
}

export async function createSale(data: {
  unitId: string
  unitType: UnitType
  customerId: string
  salePrice: number
  paymentMethod: string
  downPayment: number
  monthlyPayment: number
  saleDate: string
  contractSigned: boolean
  notes: string
}) {
  const unitIdField = data.unitType === 'apartment' ? 'apartment_id'
    : data.unitType === 'garage' ? 'garage_id'
      : 'repository_id'

  const remainingAmount = data.salePrice - data.downPayment

  return supabase
    .from('sales')
    .insert({
      [unitIdField]: data.unitId,
      customer_id: data.customerId,
      sale_price: data.salePrice,
      payment_method: data.paymentMethod,
      down_payment: data.downPayment,
      total_paid: data.downPayment,
      remaining_amount: remainingAmount,
      monthly_payment: data.monthlyPayment,
      sale_date: data.saleDate,
      contract_signed: data.contractSigned,
      notes: data.notes
    })
    .select()
    .single()
}
