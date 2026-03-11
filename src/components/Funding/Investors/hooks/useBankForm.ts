import { useState } from 'react'
import { INITIAL_BANK_FORM, type BankFormData } from '../types'
import type { Bank } from '../../../../lib/supabase'

export function useBankForm() {
  const [showBankForm, setShowBankForm] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [newBank, setNewBank] = useState<BankFormData>({ ...INITIAL_BANK_FORM })

  const handleEditBank = (bank: Bank) => {
    setEditingBank(bank)
    setNewBank({
      name: bank.name,
      contact_person: bank.contact_person || '',
      contact_email: bank.contact_email || '',
      contact_phone: bank.contact_phone || ''
    })
    setShowBankForm(true)
  }

  const resetBankForm = () => {
    setNewBank({ ...INITIAL_BANK_FORM })
    setEditingBank(null)
    setShowBankForm(false)
  }

  return {
    showBankForm,
    setShowBankForm,
    editingBank,
    newBank,
    setNewBank,
    handleEditBank,
    resetBankForm,
  }
}
