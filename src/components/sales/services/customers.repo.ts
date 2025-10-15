import { supabase } from './supabaseClient'

export async function listCustomers() {
  return supabase
    .from('customers')
    .select('*')
    .order('name')
}

export async function createCustomer(data: {
  name: string
  surname: string
  email: string
  phone: string
  address: string
  status: string
}) {
  return supabase
    .from('customers')
    .insert(data)
    .select()
    .single()
}

export async function updateCustomerStatus(customerId: string, status: string) {
  return supabase
    .from('customers')
    .update({ status })
    .eq('id', customerId)
}
