import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import DateInput from '../Common/DateInput'
import CurrencyInput from '../Common/CurrencyInput'
import { useBankInvoiceData } from './hooks/useBankInvoiceData'
import InvoicePreview from './components/InvoicePreview'
import type { BankInvoiceFormModalProps, BankInvoiceFormData, CalculatedTotals } from './types/bankInvoiceTypes'
import { Button, Modal, FormField, Input, Select, Textarea } from '../ui'

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
    <Modal show={true} onClose={onClose} size="md">
      <Modal.Header title="Novi Račun Banka" onClose={onClose} />

      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Tip" required>
              <Select
                value={formData.invoice_type}
                onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as any })}
                required
              >
                <option value="INCOMING_BANK">Odljev</option>
                <option value="OUTGOING_BANK">Priljev</option>
              </Select>
            </FormField>

            <FormField label="Moja firma" required>
              <Select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                required
              >
                <option value="">Odaberi firmu</option>
                {myCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Investitor" required>
              <Select
                value={formData.bank_id}
                onChange={(e) => setFormData({ ...formData, bank_id: e.target.value })}
                required
              >
                <option value="">Odaberi banku</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} {bank.oib && `(${bank.oib})`}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Investicija (opcionalno)"
              helperText={formData.bank_id && credits.length === 0 ? 'Nema dostupnih kredita za ovu banku' : undefined}
            >
              <Select
                value={formData.bank_credit_id}
                onChange={(e) => setFormData({ ...formData, bank_credit_id: e.target.value })}
                disabled={!formData.bank_id || credits.length === 0}
              >
                <option value="">Bez kredita</option>
                {credits.map((credit) => (
                  <option key={credit.id} value={credit.id}>
                    {credit.credit_name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Broj računa" required>
              <Input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="npr. INV-2024-001"
                required
              />
            </FormField>

            <FormField label="Poziv na broj">
              <Input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="HR12-3456-7890"
              />
            </FormField>

            <FormField label="IBAN">
              <Input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                placeholder="HR1234567890123456789"
              />
            </FormField>

            <FormField label="Datum izdavanja" required>
              <DateInput
                value={formData.issue_date}
                onChange={(value) => setFormData({ ...formData, issue_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </FormField>

            <FormField label="Datum dospjeća" required>
              <DateInput
                value={formData.due_date}
                onChange={(value) => setFormData({ ...formData, due_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </FormField>

            <FormField label="Osnovica PDV 25% (€)">
              <CurrencyInput
                value={formData.base_amount_1}
                onChange={(value) => setFormData({ ...formData, base_amount_1: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <FormField label="Osnovica PDV 13% (€)">
              <CurrencyInput
                value={formData.base_amount_2}
                onChange={(value) => setFormData({ ...formData, base_amount_2: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <FormField label="Osnovica PDV 5% (€)">
              <CurrencyInput
                value={formData.base_amount_4}
                onChange={(value) => setFormData({ ...formData, base_amount_4: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <FormField label="Osnovica PDV 0% (€)">
              <CurrencyInput
                value={formData.base_amount_3}
                onChange={(value) => setFormData({ ...formData, base_amount_3: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <InvoicePreview formData={formData} calc={calc} />

            <FormField label="Kategorija" required>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Odaberi kategoriju</option>
                {invoiceCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Opis">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Dodatni opis računa..."
            />
          </FormField>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Odustani
            </Button>
            <Button
              type="submit"
              variant="success"
              loading={loading}
            >
              {loading ? 'Kreiranje...' : 'Kreiraj račun'}
            </Button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  )
}

export default BankInvoiceFormModal
