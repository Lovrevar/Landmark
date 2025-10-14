import { supabase, ApartmentPayment } from '../../../lib/supabase'

export const apartmentPaymentService = {
  async fetchPayments(apartmentId: string): Promise<ApartmentPayment[]> {
    const { data, error } = await supabase
      .from('apartment_payments')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching apartment payments:', error)
      throw error
    }

    return data || []
  },

  async createPayment(
    apartmentId: string,
    amount: number,
    paymentDate: string | null,
    notes: string | null
  ): Promise<boolean> {
    try {
      const { error: paymentError } = await supabase
        .from('apartment_payments')
        .insert({
          apartment_id: apartmentId,
          amount,
          payment_date: paymentDate || null,
          notes: notes || null
        })

      if (paymentError) {
        console.error('Error creating apartment payment:', paymentError)
        return false
      }

      const { data: saleData, error: fetchError } = await supabase
        .from('sales')
        .select('total_paid, sale_price')
        .eq('apartment_id', apartmentId)
        .single()

      if (fetchError || !saleData) {
        console.error('Error fetching sale data:', fetchError)
        return false
      }

      const newTotalPaid = saleData.total_paid + amount
      const newRemainingAmount = saleData.sale_price - newTotalPaid

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          remaining_amount: newRemainingAmount
        })
        .eq('apartment_id', apartmentId)

      if (updateError) {
        console.error('Error updating sale totals:', updateError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in createPayment:', error)
      return false
    }
  },

  async deletePayment(paymentId: string, apartmentId: string, amount: number): Promise<boolean> {
    try {
      const { error: deleteError } = await supabase
        .from('apartment_payments')
        .delete()
        .eq('id', paymentId)

      if (deleteError) {
        console.error('Error deleting apartment payment:', deleteError)
        return false
      }

      const { data: saleData, error: fetchError } = await supabase
        .from('sales')
        .select('total_paid, sale_price')
        .eq('apartment_id', apartmentId)
        .single()

      if (fetchError || !saleData) {
        console.error('Error fetching sale data:', fetchError)
        return false
      }

      const newTotalPaid = saleData.total_paid - amount
      const newRemainingAmount = saleData.sale_price - newTotalPaid

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          remaining_amount: newRemainingAmount
        })
        .eq('apartment_id', apartmentId)

      if (updateError) {
        console.error('Error updating sale totals:', updateError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in deletePayment:', error)
      return false
    }
  }
}
