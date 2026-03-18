import React, { useState, useEffect } from 'react'
import DateInput from '../../../Common/DateInput'
import CurrencyInput from '../../../Common/CurrencyInput'
import { useBankInvoiceData } from '../Hooks/useBankInvoiceData'
import InvoicePreview from '../../Invoices/InvoicePreview'
import type { BankInvoiceFormModalProps, BankInvoiceFormData, CalculatedTotals } from '../bankInvoiceTypes'
import { Alert, Button, Modal, FormField, Input, Select, Textarea, Form } from '../../../ui'
import { createBankInvoice } from '../../Invoices/Services/invoiceService'
import { useToast } from '../../../../contexts/ToastContext'

const BankInvoiceFormModal: React.FC<BankInvoiceFormModalProps> = ({ onClose, onSuccess }) => {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [amountError, setAmountError] = useState('')
  const [formData, setFormData] = useState<BankInvoiceFormData>({
    invoice_type: 'INCOMING_BANK',
    company_id: '',
    bank_id: '',
    bank_credit_id: '',
    credit_allocation_id: '',
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

  const { banks, credits, creditAllocations, myCompanies, invoiceCategories, fetchMyCompanies } = useBankInvoiceData(formData.bank_id, formData.bank_credit_id || undefined)

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
      setFormData(prev => ({ ...prev, bank_credit_id: '', credit_allocation_id: '' }))
    }
  }, [formData.bank_id])

  useEffect(() => {
    setFormData(prev => ({ ...prev, credit_allocation_id: '' }))
  }, [formData.bank_credit_id])

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

    const errors: Record<string, string> = {}
    if (!formData.company_id) errors.company_id = 'Firma je obavezna'
    if (!formData.bank_id) errors.bank_id = 'Investitor je obavezan'
    if (!formData.invoice_number.trim()) errors.invoice_number = 'Broj računa je obavezan'
    if (!formData.category) errors.category = 'Kategorija je obavezna'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const noAmount = formData.base_amount_1 === 0 && formData.base_amount_2 === 0 && formData.base_amount_3 === 0 && formData.base_amount_4 === 0
    setAmountError(noAmount ? 'Unesite barem jednu osnovicu' : '')
    if (noAmount) return

    setLoading(true)

    try {
      calculateTotal()

      const invoiceData = {
        invoice_type: formData.invoice_type,
        invoice_category: 'BANK_CREDIT',
        company_id: formData.company_id,
        bank_id: formData.bank_id,
        bank_credit_id: formData.bank_credit_id || null,
        credit_allocation_id: (formData.invoice_type === 'OUTGOING_BANK' && formData.credit_allocation_id) ? formData.credit_allocation_id : null,
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

      await createBankInvoice(invoiceData)

      onSuccess()
      onClose()
    } catch (error: unknown) {
      console.error('Error creating invoice:', error)
      toast.error('Greška pri kreiranju računa: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const calc = calculateTotal()

  return (
    <Modal show={true} onClose={onClose} size="md">
      <Modal.Header title="Novi Račun Banka" onClose={onClose} />

      <Modal.Body>
        <Form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Tip" required>
              <Select
                value={formData.invoice_type}
                onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as BankInvoiceFormData['invoice_type'] })}
              >
                <option value="INCOMING_BANK">Odljev</option>
                <option value="OUTGOING_BANK">Priljev</option>
                <option value="INCOMING_BANK_EXPENSES">Troškovi kredita</option>
              </Select>
            </FormField>

            <FormField label="Moja firma" required error={fieldErrors.company_id}>
              <Select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="">Odaberi firmu</option>
                {myCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Investitor" required error={fieldErrors.bank_id}>
              <Select
                value={formData.bank_id}
                onChange={(e) => setFormData({ ...formData, bank_id: e.target.value })}
              >
                <option value="">Odaberi investitora</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} {bank.oib && `(${bank.oib})`}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label={formData.invoice_type === 'INCOMING_BANK_EXPENSES' ? 'Investicija' : 'Investicija (opcionalno)'}
              helperText={formData.bank_id && credits.length === 0 ? 'Nema dostupnih investicija za ovog investitora' : undefined}
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

            {formData.invoice_type === 'OUTGOING_BANK' && formData.bank_credit_id && (
              <FormField
                label="Namjena investicije (alokacija)"
                helperText={creditAllocations.length === 0 ? 'Nema definiranih namjena za ovu investiciju' : undefined}
              >
                <Select
                  value={formData.credit_allocation_id}
                  onChange={(e) => setFormData({ ...formData, credit_allocation_id: e.target.value })}
                  disabled={creditAllocations.length === 0}
                >
                  <option value="">Bez namjene</option>
                  {creditAllocations.map((alloc) => {
                    const available = alloc.allocated_amount - alloc.used_amount
                    const label =
                      alloc.allocation_type === 'project'
                        ? alloc.project?.name ?? 'Projekt'
                        : alloc.allocation_type === 'opex'
                        ? 'OPEX'
                        : 'Refinanciranje'
                    return (
                      <option key={alloc.id} value={alloc.id}>
                        {label} — dostupno: €{available.toLocaleString('hr-HR')}
                      </option>
                    )
                  })}
                </Select>
              </FormField>
            )}

            <FormField label="Broj računa" required error={fieldErrors.invoice_number}>
              <Input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="npr. INV-2024-001"
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
              />
            </FormField>

            <FormField label="Datum dospjeća" required>
              <DateInput
                value={formData.due_date}
                onChange={(value) => setFormData({ ...formData, due_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

            <FormField label="Kategorija" required error={fieldErrors.category}>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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

          {amountError && (
            <Alert variant="error" className="mb-2" onDismiss={() => setAmountError('')}>
              {amountError}
            </Alert>
          )}

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
        </Form>
      </Modal.Body>
    </Modal>
  )
}

export default BankInvoiceFormModal
