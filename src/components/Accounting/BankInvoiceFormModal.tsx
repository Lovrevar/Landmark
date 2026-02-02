import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, DollarSign } from 'lucide-react'
import DateInput from '../Common/DateInput'

interface BankInvoiceFormModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface BankCompany {
  id: string
  name: string
  oib: string
  bank_id: string | null
}

interface BankCredit {
  id: string
  company_id: string
  credit_name: string
  amount: number
  outstanding_balance: number
}

interface MyCompany {
  id: string
  name: string
}

const BankInvoiceFormModal: React.FC<BankInvoiceFormModalProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState<BankCompany[]>([])
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [myCompanies, setMyCompanies] = useState<MyCompany[]>([])
  const [invoiceCategories, setInvoiceCategories] = useState<{ id: string; name: string }[]>([])

  const [formData, setFormData] = useState({
    invoice_type: 'INCOMING_BANK' as 'INCOMING_BANK' | 'OUTGOING_BANK',
    company_id: '',
    bank_id: '',
    bank_credit_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    base_amount: '',
    vat_rate: '0',
    base_amount_1: 0,
    base_amount_2: 0,
    base_amount_3: 0,
    base_amount_4: 0,
    category: '',
    description: ''
  })

  useEffect(() => {
    fetchBanks()
    fetchMyCompanies()
    fetchInvoiceCategories()
  }, [])

  const fetchInvoiceCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order')

      if (!error) {
        setInvoiceCategories(data || [])
      }
    } catch (error) {
      console.error('Error fetching invoice categories:', error)
    }
  }

  useEffect(() => {
    if (formData.bank_id) {
      fetchCredits(formData.bank_id)
    } else {
      setCredits([])
      setFormData(prev => ({ ...prev, bank_credit_id: '' }))
    }
  }, [formData.bank_id])

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_companies')
        .select('id, name, oib, bank_id')
        .eq('is_bank', true)
        .order('name')

      if (error) throw error
      setBanks(data || [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      alert('Greška pri učitavanju banaka')
    }
  }

  const fetchCredits = async (bankCompanyId: string) => {
    try {
      const selectedBank = banks.find(b => b.id === bankCompanyId)
      if (!selectedBank || !selectedBank.bank_id) {
        setCredits([])
        return
      }

      const { data, error } = await supabase
        .from('bank_credits')
        .select('id, company_id, credit_name, amount, outstanding_balance')
        .eq('bank_id', selectedBank.bank_id)
        .order('credit_name')

      if (error) throw error
      setCredits(data || [])
    } catch (error) {
      console.error('Error fetching credits:', error)
      setCredits([])
    }
  }

  const fetchMyCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_companies')
        .select('id, name')
        .eq('is_bank', false)
        .order('name')

      if (error) throw error
      setMyCompanies(data || [])
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, company_id: data[0].id }))
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }

  const calculateTotal = () => {
    const base1 = formData.base_amount_1 || 0
    const base2 = formData.base_amount_2 || 0
    const base3 = formData.base_amount_3 || 0
    const base4 = formData.base_amount_4 || 0

    const vat1 = base1 * 0.25
    const vat2 = base2 * 0.13
    const vat3 = 0
    const vat4 = base4 * 0.05

    const total = (base1 + vat1) + (base2 + vat2) + base3 + (base4 + vat4)

    return {
      vat1,
      vat2,
      vat3,
      vat4,
      subtotal1: base1 + vat1,
      subtotal2: base2 + vat2,
      subtotal3: base3,
      subtotal4: base4 + vat4,
      total
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.company_id || !formData.bank_id || !formData.invoice_number) {
      alert('Molimo popunite sva obavezna polja')
      return
    }

    if (formData.base_amount_1 === 0 && formData.base_amount_2 === 0 && formData.base_amount_3 === 0 && formData.base_amount_4 === 0) {
      alert('Molimo unesite barem jednu osnovicu')
      return
    }

    setLoading(true)

    try {
      const { total } = calculateTotal()

      const invoiceData = {
        invoice_type: formData.invoice_type,
        invoice_category: 'BANK_CREDIT',
        company_id: formData.company_id,
        bank_id: formData.bank_id,
        bank_credit_id: formData.bank_credit_id || null,
        invoice_number: formData.invoice_number,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        base_amount_1: formData.base_amount_1 || 0,
        base_amount_2: formData.base_amount_2 || 0,
        base_amount_3: formData.base_amount_3 || 0,
        base_amount_4: formData.base_amount_4 || 0,
        category: formData.category,
        description: formData.description
      }

      const { error } = await supabase
        .from('accounting_invoices')
        .insert([invoiceData])

      if (error) throw error

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating invoice:', error)
      alert('Greška pri kreiranju računa: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const calc = calculateTotal()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <DollarSign className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Novi Račun Banka</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tip računa *
              </label>
              <select
                value={formData.invoice_type}
                onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="INCOMING_BANK">Ulazni</option>
                <option value="OUTGOING_BANK">Izlazni</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moja firma *
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="">Odaberi firmu</option>
                {myCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banka *
              </label>
              <select
                value={formData.bank_id}
                onChange={(e) => setFormData({ ...formData, bank_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="">Odaberi banku</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} {bank.oib && `(${bank.oib})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kredit (opcionalno)
              </label>
              <select
                value={formData.bank_credit_id}
                onChange={(e) => setFormData({ ...formData, bank_credit_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={!formData.bank_id || credits.length === 0}
              >
                <option value="">Bez kredita</option>
                {credits.map((credit) => (
                  <option key={credit.id} value={credit.id}>
                    {credit.credit_name}
                  </option>
                ))}
              </select>
              {formData.bank_id && credits.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">Nema dostupnih kredita za ovu banku</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Broj računa *
              </label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="npr. INV-2024-001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Datum izdavanja *
              </label>
              <DateInput
                value={formData.issue_date}
                onChange={(value) => setFormData({ ...formData, issue_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Datum dospjeća *
              </label>
              <DateInput
                value={formData.due_date}
                onChange={(value) => setFormData({ ...formData, due_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica PDV 25% (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.base_amount_1 || ''}
                onChange={(e) => setFormData({ ...formData, base_amount_1: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica PDV 13% (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.base_amount_2 || ''}
                onChange={(e) => setFormData({ ...formData, base_amount_2: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica PDV 5% (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.base_amount_4 || ''}
                onChange={(e) => setFormData({ ...formData, base_amount_4: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica PDV 0% (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.base_amount_3 || ''}
                onChange={(e) => setFormData({ ...formData, base_amount_3: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            {(formData.base_amount_1 > 0 || formData.base_amount_2 > 0 || formData.base_amount_3 > 0 || formData.base_amount_4 > 0) && (
              <div className="col-span-2 bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-2">Pregled računa:</div>

                {formData.base_amount_1 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 25%):</span>
                      <span className="font-medium">€{formData.base_amount_1.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 25%:</span>
                      <span className="font-medium">€{calc.vat1.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal1.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {formData.base_amount_2 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 13%):</span>
                      <span className="font-medium">€{formData.base_amount_2.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 13%:</span>
                      <span className="font-medium">€{calc.vat2.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal2.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {formData.base_amount_4 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 5%):</span>
                      <span className="font-medium">€{formData.base_amount_4.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 5%:</span>
                      <span className="font-medium">€{calc.vat4.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal4.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {formData.base_amount_3 > 0 && (
                  <div className="space-y-1 pb-2 border-b border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Osnovica (PDV 0%):</span>
                      <span className="font-medium">€{formData.base_amount_3.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PDV 0%:</span>
                      <span className="font-medium">€0.00</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>€{calc.subtotal3.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold pt-2">
                  <span>UKUPNO:</span>
                  <span>€{calc.total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategorija *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="">Odaberi kategoriju</option>
                {invoiceCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opis
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Dodatni opis računa..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Kreiranje...' : 'Kreiraj račun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BankInvoiceFormModal
