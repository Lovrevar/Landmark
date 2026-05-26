import { useState } from 'react'
import { INITIAL_EQUITY_FORM, type EquityFormData } from '../types'
import { useToast } from '../../../../contexts/ToastContext'
import { createEquityInvestment } from '../services/equityService'

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
      await createEquityInvestment(newEquity)
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
