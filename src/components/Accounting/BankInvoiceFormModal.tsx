import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, DollarSign } from 'lucide-react'
import DateInput from '../Common/DateInput'
import CurrencyInput from '../Common/CurrencyInput'
import { useBankInvoiceData } from './hooks/useBankInvoiceData'
import InvoicePreview from './components/InvoicePreview'
import type { BankInvoiceFormModalProps, BankInvoiceFormData, CalculatedTotals } from './types/bankInvoiceTypes'

const BankInvoiceFormModal: React.FC<BankInvoiceFormModalProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<BankInvoiceFormData>({
    invoice_type: 'INCOMING_BANK',
    company_id: '',
    bank_id: '',
    bank_credit_id: '',
    invoice_number: '',
    reference_number: '',
    iban: '',
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

  const { banks, credits, myCompanies, invoiceCategories, fetchMyCompanies } = useBankInvoiceData(formData.bank_id)

  useEffect(() => {
    const initializeCompany = async () => {
      const companies = await fetchMyCompanies()
      if (companies && companies.length > 0) {
        setFormData(prev => ({ ...prev, company_id: companies[0].id }))
      }
    }
    initializeCompany()
  }, [])

  useEffect(() => {
    if (!formData.bank_id) {
      setFormData(prev => ({ ...prev, bank_credit_id: '' }))
    }
  }, [formData.bank_id])

  const calculateTotal = (): CalculatedTotals => {
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
        reference_number: formData.reference_number || null,
        iban: formData.iban || null,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        base_amount_1: formData.base_amount_1 || 0,
        base_amount_2: formData.base_amount_2 || 0,
        base_amount_3: formData.base_amount_3 || 0,
        base_amount_4: formData.base_amount_4 || 0,
        category: formData.category,
        description: formData.description,
        approved: true
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
                Poziv na broj
              </label>
              <input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="HR12-3456-7890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IBAN
              </label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="HR1234567890123456789"
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
              <CurrencyInput
                value={formData.base_amount_1}
                onChange={(value) => setFormData({ ...formData, base_amount_1: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica PDV 13% (€)
              </label>
              <CurrencyInput
                value={formData.base_amount_2}
                onChange={(value) => setFormData({ ...formData, base_amount_2: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica PDV 5% (€)
              </label>
              <CurrencyInput
                value={formData.base_amount_4}
                onChange={(value) => setFormData({ ...formData, base_amount_4: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Osnovica PDV 0% (€)
              </label>
              <CurrencyInput
                value={formData.base_amount_3}
                onChange={(value) => setFormData({ ...formData, base_amount_3: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </div>

            <InvoicePreview formData={formData} calc={calc} />

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
