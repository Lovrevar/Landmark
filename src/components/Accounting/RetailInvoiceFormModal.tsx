import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal, Button, Textarea, FormField, Alert } from '../ui'
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
  onSuccess,
  editingInvoice
}) => {
  const [loading, setLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    setIsInitialLoad(false)
  }, [])

  const getInitialFormData = (): RetailInvoiceFormData => {
    if (editingInvoice) {
      let invoiceType: 'incoming' | 'outgoing' = 'incoming'
      let entityType: 'supplier' | 'customer' = 'supplier'
      let entityId = ''

      if (editingInvoice.invoice_type === 'INCOMING_SUPPLIER') {
        invoiceType = 'incoming'
        entityType = 'supplier'
        entityId = editingInvoice.retail_supplier_id || ''
      } else if (editingInvoice.invoice_type === 'OUTGOING_SALES') {
        invoiceType = 'outgoing'
        entityType = 'customer'
        entityId = editingInvoice.retail_customer_id || ''
      } else if (editingInvoice.invoice_type === 'OUTGOING_SUPPLIER') {
        invoiceType = 'outgoing'
        entityType = 'supplier'
        entityId = editingInvoice.retail_supplier_id || ''
      } else if (editingInvoice.invoice_type === 'INCOMING_INVESTMENT') {
        invoiceType = 'incoming'
        entityType = 'customer'
        entityId = editingInvoice.retail_customer_id || ''
      }

      let base1 = editingInvoice.base_amount_1 || 0
      let base2 = editingInvoice.base_amount_2 || 0
      let base3 = editingInvoice.base_amount_3 || 0
      let base4 = editingInvoice.base_amount_4 || 0

      const hasMultipleVatRates = base1 + base2 + base3 + base4 > 0

      if (!hasMultipleVatRates && editingInvoice.base_amount > 0) {
        const vatRate = editingInvoice.vat_rate || 0
        if (vatRate === 25) {
          base1 = editingInvoice.base_amount
        } else if (vatRate === 13) {
          base2 = editingInvoice.base_amount
        } else if (vatRate === 0) {
          base3 = editingInvoice.base_amount
        } else if (vatRate === 5) {
          base4 = editingInvoice.base_amount
        }
      }

      return {
        invoice_type: invoiceType,
        entity_type: entityType,
        entity_id: entityId,
        company_id: editingInvoice.company_id,
        retail_project_id: editingInvoice.retail_project_id || '',
        retail_contract_id: editingInvoice.retail_contract_id || '',
        retail_milestone_id: editingInvoice.retail_milestone_id || '',
        refund_id: editingInvoice.refund_id ? String(editingInvoice.refund_id) : '',
        invoice_number: editingInvoice.invoice_number,
        reference_number: editingInvoice.reference_number || '',
        iban: editingInvoice.iban || '',
        issue_date: editingInvoice.issue_date,
        due_date: editingInvoice.due_date,
        base_amount: '',
        vat_rate: '25',
        base_amount_1: base1,
        base_amount_2: base2,
        base_amount_3: base3,
        base_amount_4: base4,
        category: editingInvoice.category || '',
        notes: editingInvoice.description || ''
      }
    }

    return {
      invoice_type: 'incoming',
      entity_type: 'supplier',
      entity_id: '',
      company_id: '',
      retail_project_id: '',
      retail_contract_id: '',
      retail_milestone_id: '',
      refund_id: '',
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
    }
  }

  const [formData, setFormData] = useState<RetailInvoiceFormData>(getInitialFormData())

  const {
    companies,
    suppliers,
    customers,
    projects,
    contracts,
    milestones,
    invoiceCategories,
    refunds,
    error,
    setError
  } = useRetailInvoiceData(formData)

  useEffect(() => {
    setFormData(getInitialFormData())
  }, [editingInvoice])

  useEffect(() => {
    if (!isInitialLoad) {
      setFormData(prev => ({ ...prev, entity_id: '', retail_contract_id: '', retail_milestone_id: '' }))
    }
  }, [formData.entity_type])

  useEffect(() => {
    if (!isInitialLoad && (!formData.retail_project_id || !formData.entity_id)) {
      setFormData(prev => ({ ...prev, retail_contract_id: '', retail_milestone_id: '' }))
    }
  }, [formData.retail_project_id, formData.entity_id])

  useEffect(() => {
    if (!isInitialLoad && !formData.retail_contract_id) {
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
        refund_id: formData.refund_id ? parseInt(formData.refund_id) : null,
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

      if (editingInvoice) {
        const { error: updateError } = await supabase
          .from('accounting_invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('accounting_invoices')
          .insert(invoiceData)

        if (insertError) throw insertError
      }

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
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header title={editingInvoice ? 'Uredi Retail Račun' : 'Novi Retail Račun'} onClose={onClose} />

      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body>
          {error && (
            <Alert variant="error">{error}</Alert>
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
            refunds={refunds}
          />

          <RetailInvoiceCalculationSummary
            base_amount_1={formData.base_amount_1}
            base_amount_2={formData.base_amount_2}
            base_amount_3={formData.base_amount_3}
            base_amount_4={formData.base_amount_4}
            calculation={calc}
          />

          <FormField label="Napomene">
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Dodatne napomene..."
            />
          </FormField>
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Odustani
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
          >
            {loading ? (editingInvoice ? 'Spremanje...' : 'Kreiranje...') : (editingInvoice ? 'Spremi izmjene' : 'Kreiraj račun')}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
