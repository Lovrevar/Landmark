import { useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { INITIAL_EQUITY_FORM, type EquityFormData } from '../types'
import { format } from 'date-fns'
import { useToast } from '../../../../contexts/ToastContext'

export function useEquityForm(onSaved: () => Promise<void>) {
  const toast = useToast()
  const [showEquityForm, setShowEquityForm] = useState(false)
  const [newEquity, setNewEquity] = useState<EquityFormData>({ ...INITIAL_EQUITY_FORM })

  const addEquity = async () => {
    if (!newEquity.bank_id || !newEquity.amount || !newEquity.investment_date) {
      toast.warning('Please fill in required fields (Bank, Amount, Investment Date)')
      return
    }

    try {
      const { error } = await supabase
        .from('bank_credits')
        .insert({
          bank_id: newEquity.bank_id,
          company_id: newEquity.company_id || null,
          project_id: null,
          credit_name: `Equity Investment ${format(new Date(newEquity.investment_date), 'MMM yyyy')}`,
          credit_type: 'equity',
          credit_seniority: 'junior',
          amount: newEquity.amount,
          interest_rate: newEquity.expected_return,
          start_date: newEquity.investment_date,
          maturity_date: newEquity.maturity_date || null,
          usage_expiration_date: newEquity.usage_expiration_date || null,
          outstanding_balance: newEquity.amount,
          status: 'active',
          purpose: newEquity.terms || null,
          grace_period: newEquity.grace_period || 0,
          repayment_type: newEquity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
          principal_repayment_type: newEquity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
          interest_repayment_type: newEquity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
          monthly_payment: 0
        })

      if (error) throw error

      logActivity({ action: 'equity_investment.create', entity: 'equity_investment', metadata: { severity: 'high', amount: newEquity.amount } })

      setShowEquityForm(false)
      setNewEquity({ ...INITIAL_EQUITY_FORM })
      await onSaved()
      toast.success('Equity investment added successfully')
    } catch (error) {
      console.error('Error adding equity:', error)
      toast.error('Error adding equity investment.')
    }
  }

  return {
    showEquityForm,
    setShowEquityForm,
    newEquity,
    setNewEquity,
    addEquity,
  }
}
