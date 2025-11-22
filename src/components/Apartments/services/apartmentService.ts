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
  // Get first active company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (companyError) throw companyError
  if (!company) throw new Error('No active company found')

  // Generate invoice number
  const invoiceNumber = `SALE-${Date.now()}`

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('accounting_invoices')
    .insert({
      invoice_type: 'INCOME',
      invoice_category: 'APARTMENT',
      company_id: company.id,
      customer_id: customerId,
      apartment_id: apartmentId,
      project_id: projectId,
      invoice_number: invoiceNumber,
      issue_date: paymentDate,
      due_date: paymentDate,
      base_amount: amount,
      vat_rate: 0,
      category: paymentType,
      description: notes || `Apartment payment - ${paymentType}`
    })
    .select()
    .single()

  if (invoiceError) throw invoiceError

  // Create payment
  const { data: payment, error: paymentError } = await supabase
    .from('accounting_payments')
    .insert({
      invoice_id: invoice.id,
      payment_date: paymentDate,
      amount: amount,
      payment_method: 'WIRE',
      reference_number: saleId || '',
      description: notes || `Apartment payment - ${paymentType}`
    })
    .select()
    .single()

  if (paymentError) throw paymentError

  // Update sales total if saleId provided
  if (saleId) {
    const { data: allPaymentsData } = await supabase
      .from('accounting_payments')
      .select('amount, invoice:accounting_invoices!inner(customer_id, apartment_id)')
      .eq('invoice.customer_id', customerId)
      .eq('invoice.apartment_id', apartmentId)

    const totalPaid = allPaymentsData?.reduce((sum, p) => sum + p.amount, 0) || 0

    const { data: sale } = await supabase
      .from('sales')
      .select('sale_price')
      .eq('id', saleId)
      .single()

    if (sale) {
      await supabase
        .from('sales')
        .update({
          total_paid: totalPaid,
          remaining_amount: sale.sale_price - totalPaid
        })
        .eq('id', saleId)
    }
  }

  return payment
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

export const updatePayment = async (
  paymentId: string,
  amount: number,
  paymentDate: string,
  paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other',
  notes: string,
  saleId: string | null
) => {
  // Get invoice_id for this payment
  const { data: payment, error: getError } = await supabase
    .from('accounting_payments')
    .select('invoice_id')
    .eq('id', paymentId)
    .single()

  if (getError) throw getError

  // Update invoice category
  await supabase
    .from('accounting_invoices')
    .update({
      category: paymentType,
      description: notes
    })
    .eq('id', payment.invoice_id)

  // Update payment
  const { error: updateError } = await supabase
    .from('accounting_payments')
    .update({
      amount,
      payment_date: paymentDate,
      description: notes
    })
    .eq('id', paymentId)

  if (updateError) throw updateError

  // Recalculate sales total if needed
  if (saleId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('apartment_id, customer_id, sale_price')
      .eq('id', saleId)
      .single()

    if (sale) {
      const { data: allPaymentsData } = await supabase
        .from('accounting_payments')
        .select('amount, invoice:accounting_invoices!inner(customer_id, apartment_id)')
        .eq('invoice.customer_id', sale.customer_id)
        .eq('invoice.apartment_id', sale.apartment_id)

      const totalPaid = allPaymentsData?.reduce((sum, p) => sum + p.amount, 0) || 0

      await supabase
        .from('sales')
        .update({
          total_paid: totalPaid,
          remaining_amount: sale.sale_price - totalPaid
        })
        .eq('id', saleId)
    }
  }
}

export const deletePayment = async (paymentId: string, saleId: string | null, amount: number) => {
  const { error: deleteError } = await supabase
    .from('accounting_payments')
    .delete()
    .eq('id', paymentId)

  if (deleteError) throw deleteError

  if (saleId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('apartment_id, customer_id, sale_price')
      .eq('id', saleId)
      .single()

    if (sale) {
      const { data: allPaymentsData } = await supabase
        .from('accounting_payments')
        .select('amount, invoice:accounting_invoices!inner(customer_id, apartment_id)')
        .eq('invoice.customer_id', sale.customer_id)
        .eq('invoice.apartment_id', sale.apartment_id)

      const totalPaid = allPaymentsData?.reduce((sum, p) => sum + p.amount, 0) || 0

      await supabase
        .from('sales')
        .update({
          total_paid: totalPaid,
          remaining_amount: sale.sale_price - totalPaid
        })
        .eq('id', saleId)
    }
  }
}

export const addMultiplePayments = async (
  payments: Array<{
    unitId: string
    unitType: 'apartment' | 'garage' | 'storage'
    amount: number
  }>,
  customerId: string,
  projectId: string,
  saleId: string | null,
  paymentDate: string,
  paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other',
  notes: string
) => {
  // Get first active company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (companyError) throw companyError
  if (!company) throw new Error('No active company found')

  const createdPayments = []

  // Create invoice + payment for each unit
  for (const payment of payments) {
    const invoiceNumber = `SALE-${Date.now()}-${payment.unitId.substring(0, 8)}`

    let apartmentId = null
    if (payment.unitType === 'apartment') {
      apartmentId = payment.unitId
    }

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('accounting_invoices')
      .insert({
        invoice_type: 'INCOME',
        invoice_category: 'APARTMENT',
        company_id: company.id,
        customer_id: customerId,
        apartment_id: apartmentId,
        project_id: projectId,
        invoice_number: invoiceNumber,
        issue_date: paymentDate,
        due_date: paymentDate,
        base_amount: payment.amount,
        vat_rate: 0,
        category: paymentType,
        description: notes || `${payment.unitType} payment - ${paymentType}`
      })
      .select()
      .single()

    if (invoiceError) throw invoiceError

    // Create payment
    const { data: paymentData, error: paymentError } = await supabase
      .from('accounting_payments')
      .insert({
        invoice_id: invoice.id,
        payment_date: paymentDate,
        amount: payment.amount,
        payment_method: 'WIRE',
        reference_number: saleId || '',
        description: notes || `${payment.unitType} payment - ${paymentType}`
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    createdPayments.push(paymentData)
  }

  // Update sales total if saleId provided
  if (saleId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('apartment_id, customer_id, sale_price')
      .eq('id', saleId)
      .single()

    if (sale) {
      const { data: allPaymentsData } = await supabase
        .from('accounting_payments')
        .select('amount, invoice:accounting_invoices!inner(customer_id, apartment_id)')
        .eq('invoice.customer_id', customerId)

      const totalPaid = allPaymentsData?.reduce((sum, p) => sum + p.amount, 0) || 0

      await supabase
        .from('sales')
        .update({
          total_paid: totalPaid,
          remaining_amount: sale.sale_price - totalPaid
        })
        .eq('id', saleId)
    }
  }

  return createdPayments
}
