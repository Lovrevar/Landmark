import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'
import { RetailInvoiceFormFields } from './forms/RetailInvoiceFormFields'
import { RetailInvoiceCalculationSummary } from './forms/RetailInvoiceCalculationSummary'
import { useRetailInvoiceData } from './hooks/useRetailInvoiceData'
import {
  RetailInvoiceFormModalProps,
  RetailInvoiceFormData,
  VatCalculation
} from './types/retailInvoiceTypes'

export const RetailInvoiceFormModal: React.FC<RetailInvoiceFormModalProps> = ({
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState<RetailInvoiceFormData>({
    invoice_type: 'incoming',
    entity_type: 'supplier',
    entity_id: '',
    company_id: '',
    retail_project_id: '',
    retail_contract_id: '',
    retail_milestone_id: '',
    invoice_number: '',
    reference_number: '',
    iban: '',
    issue_date: '',
    due_date: '',
    base_amount: '',
    vat_rate: '25',
    base_amount_1: 0,
    base_amount_2: 0,
    base_amount_3: 0,
    base_amount_4: 0,
    category: '',
    notes: ''
  })

  const {
    companies,
    suppliers,
    customers,
    projects,
    contracts,
    milestones,
    invoiceCategories,
    error,
    setError
  } = useRetailInvoiceData(formData)

  useEffect(() => {
    setFormData(prev => ({ ...prev, entity_id: '', retail_contract_id: '', retail_milestone_id: '' }))
  }, [formData.entity_type])

  useEffect(() => {
    if (!formData.retail_project_id || !formData.entity_id) {
      setFormData(prev => ({ ...prev, retail_contract_id: '', retail_milestone_id: '' }))
    }
  }, [formData.retail_project_id, formData.entity_id])

  useEffect(() => {
    if (!formData.retail_contract_id) {
      setFormData(prev => ({ ...prev, retail_milestone_id: '' }))
    }
  }, [formData.retail_contract_id])

  const calculateVatAndTotal = (): VatCalculation => {
    const base1 = formData.base_amount_1 || 0
    const base2 = formData.base_amount_2 || 0
    const base3 = formData.base_amount_3 || 0
    const base4 = formData.base_amount_4 || 0

    const vat1 = base1 * 0.25
    const vat2 = base2 * 0.13
    const vat3 = 0
    const vat4 = base4 * 0.05

    const totalAmount = (base1 + vat1) + (base2 + vat2) + base3 + (base4 + vat4)

    return {
      vat1,
      vat2,
      vat3,
      vat4,
      subtotal1: base1 + vat1,
      subtotal2: base2 + vat2,
      subtotal3: base3,
      subtotal4: base4 + vat4,
      totalAmount
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.company_id) throw new Error('Morate odabrati firmu')
      if (!formData.entity_id) throw new Error('Morate odabrati entitet')
      if (!formData.retail_project_id) throw new Error('Morate odabrati projekt')
      if (!formData.retail_contract_id) throw new Error('Morate odabrati ugovor/fazu')
      if (!formData.invoice_number) throw new Error('Morate unijeti broj računa')
      if (!formData.issue_date) throw new Error('Morate unijeti datum izdavanja')
      if (!formData.due_date) throw new Error('Morate unijeti datum dospijeća')

      if (formData.base_amount_1 === 0 && formData.base_amount_2 === 0 && formData.base_amount_3 === 0 && formData.base_amount_4 === 0) {
        throw new Error('Morate unijeti barem jednu osnovicu')
      }

      const { totalAmount } = calculateVatAndTotal()

      let invoiceType: string
      if (formData.invoice_type === 'incoming' && formData.entity_type === 'supplier') {
        invoiceType = 'INCOMING_SUPPLIER'
      } else if (formData.invoice_type === 'outgoing' && formData.entity_type === 'customer') {
        invoiceType = 'OUTGOING_SALES'
      } else if (formData.invoice_type === 'outgoing' && formData.entity_type === 'supplier') {
        invoiceType = 'OUTGOING_SUPPLIER'
      } else if (formData.invoice_type === 'incoming' && formData.entity_type === 'customer') {
        invoiceType = 'INCOMING_INVESTMENT'
      } else {
        throw new Error('Nevalidna kombinacija tipa računa i entiteta')
      }

      const invoiceData: any = {
        invoice_type: invoiceType,
        company_id: formData.company_id,
        invoice_category: 'RETAIL',
        retail_project_id: formData.retail_project_id,
        retail_contract_id: formData.retail_contract_id,
        retail_milestone_id: formData.retail_milestone_id || null,
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
        description: formData.notes || null,
        approved: false
      }

      if (formData.entity_type === 'supplier') {
        invoiceData.retail_supplier_id = formData.entity_id
      } else {
        invoiceData.retail_customer_id = formData.entity_id
      }

      const { error: insertError } = await supabase
        .from('accounting_invoices')
        .insert(invoiceData)

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error creating retail invoice:', err)
      setError(err.message || 'Greška pri kreiranju računa')
    } finally {
      setLoading(false)
    }
  }

  const calc = calculateVatAndTotal()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Novi Retail Račun</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <RetailInvoiceFormFields
            formData={formData}
            setFormData={setFormData}
            companies={companies}
            suppliers={suppliers}
            customers={customers}
            projects={projects}
            contracts={contracts}
            milestones={milestones}
            invoiceCategories={invoiceCategories}
          />

          <RetailInvoiceCalculationSummary
            base_amount_1={formData.base_amount_1}
            base_amount_2={formData.base_amount_2}
            base_amount_3={formData.base_amount_3}
            base_amount_4={formData.base_amount_4}
            calculation={calc}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Napomene
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Dodatne napomene..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Kreiranje...' : 'Kreiraj račun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
