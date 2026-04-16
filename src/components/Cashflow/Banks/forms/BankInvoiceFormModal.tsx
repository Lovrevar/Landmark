import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import DateInput from '../../../Common/DateInput'
import CurrencyInput from '../../../Common/CurrencyInput'
import { useBankInvoiceData } from '../hooks/useBankInvoiceData'
import InvoicePreview from '../../Invoices/InvoicePreview'
import type { BankInvoiceFormModalProps, BankInvoiceFormData, CalculatedTotals } from '../bankInvoiceTypes'
import { Alert, Button, Modal, FormField, Input, Select, Textarea, Form } from '../../../ui'
import { createBankInvoice } from '../../Invoices/services/invoiceService'
import { useToast } from '../../../../contexts/ToastContext'

const BankInvoiceFormModal: React.FC<BankInvoiceFormModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation()
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
    if (!formData.company_id) errors.company_id = t('banks.invoice_form.errors.company')
    if (!formData.bank_id) errors.bank_id = t('banks.invoice_form.errors.investor')
    if (!formData.invoice_number.trim()) errors.invoice_number = t('banks.invoice_form.errors.invoice_number')
    if (!formData.category) errors.category = t('banks.invoice_form.errors.category')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const noAmount = formData.base_amount_1 === 0 && formData.base_amount_2 === 0 && formData.base_amount_3 === 0 && formData.base_amount_4 === 0
    setAmountError(noAmount ? t('banks.invoice_form.amount_error') : '')
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
      toast.error(t('banks.invoice_form.error_create') + ': ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const calc = calculateTotal()

  return (
    <Modal show={true} onClose={onClose} size="md">
      <Modal.Header title={t('banks.invoice_form.title')} onClose={onClose} />

      <Modal.Body>
        <Form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('banks.invoice_form.type')} required>
              <Select
                value={formData.invoice_type}
                onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as BankInvoiceFormData['invoice_type'] })}
              >
                <option value="INCOMING_BANK">{t('banks.invoice_form.outflow')}</option>
                <option value="OUTGOING_BANK">{t('banks.invoice_form.inflow')}</option>
                <option value="INCOMING_BANK_EXPENSES">{t('banks.invoice_form.credit_expenses')}</option>
              </Select>
            </FormField>

            <FormField label={t('banks.invoice_form.my_company')} required error={fieldErrors.company_id}>
              <Select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="">{t('banks.invoice_form.select_company')}</option>
                {myCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t('banks.invoice_form.investor')} required error={fieldErrors.bank_id}>
              <Select
                value={formData.bank_id}
                onChange={(e) => setFormData({ ...formData, bank_id: e.target.value })}
              >
                <option value="">{t('banks.invoice_form.select_investor')}</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} {bank.oib && `(${bank.oib})`}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label={formData.invoice_type === 'INCOMING_BANK_EXPENSES' ? t('banks.invoice_form.investment') : t('banks.invoice_form.investment_optional')}
              helperText={formData.bank_id && credits.length === 0 ? t('banks.invoice_form.no_investments') : undefined}
            >
              <Select
                value={formData.bank_credit_id}
                onChange={(e) => setFormData({ ...formData, bank_credit_id: e.target.value })}
                disabled={!formData.bank_id || credits.length === 0}
              >
                <option value="">{t('banks.invoice_form.no_credit')}</option>
                {credits.map((credit) => (
                  <option key={credit.id} value={credit.id}>
                    {credit.credit_name}
                  </option>
                ))}
              </Select>
            </FormField>

            {formData.invoice_type === 'OUTGOING_BANK' && formData.bank_credit_id && (
              <FormField
                label={t('banks.invoice_form.allocation')}
                helperText={creditAllocations.length === 0 ? t('banks.invoice_form.no_allocations') : undefined}
              >
                <Select
                  value={formData.credit_allocation_id}
                  onChange={(e) => setFormData({ ...formData, credit_allocation_id: e.target.value })}
                  disabled={creditAllocations.length === 0}
                >
                  <option value="">{t('banks.invoice_form.no_purpose')}</option>
                  {creditAllocations.map((alloc) => {
                    const available = alloc.allocated_amount - alloc.used_amount
                    const label =
                      alloc.allocation_type === 'project'
                        ? alloc.project?.name ?? t('banks.invoice_form.project')
                        : alloc.allocation_type === 'opex'
                        ? t('banks.invoice_form.opex')
                        : t('banks.invoice_form.refinancing')
                    return (
                      <option key={alloc.id} value={alloc.id}>
                        {label} — {t('banks.invoice_form.available')}: €{available.toLocaleString('hr-HR')}
                      </option>
                    )
                  })}
                </Select>
              </FormField>
            )}

            <FormField label={t('banks.invoice_form.invoice_number')} required error={fieldErrors.invoice_number}>
              <Input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="npr. INV-2024-001"
              />
            </FormField>

            <FormField label={t('banks.invoice_form.reference_number')}>
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

            <FormField label={t('banks.invoice_form.issue_date')} required>
              <DateInput
                value={formData.issue_date}
                onChange={(value) => setFormData({ ...formData, issue_date: value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </FormField>

            <FormField label={t('banks.invoice_form.due_date')} required>
              <DateInput
                value={formData.due_date}
                onChange={(value) => setFormData({ ...formData, due_date: value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </FormField>

            <FormField label={t('banks.invoice_form.base_25')}>
              <CurrencyInput
                value={formData.base_amount_1}
                onChange={(value) => setFormData({ ...formData, base_amount_1: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <FormField label={t('banks.invoice_form.base_13')}>
              <CurrencyInput
                value={formData.base_amount_2}
                onChange={(value) => setFormData({ ...formData, base_amount_2: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <FormField label={t('banks.invoice_form.base_5')}>
              <CurrencyInput
                value={formData.base_amount_4}
                onChange={(value) => setFormData({ ...formData, base_amount_4: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <FormField label={t('banks.invoice_form.base_0')}>
              <CurrencyInput
                value={formData.base_amount_3}
                onChange={(value) => setFormData({ ...formData, base_amount_3: value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min={0}
              />
            </FormField>

            <InvoicePreview formData={formData} calc={calc} />

            <FormField label={t('banks.invoice_form.category')} required error={fieldErrors.category}>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">{t('banks.invoice_form.select_category')}</option>
                {invoiceCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label={t('banks.invoice_form.description')}>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder={t('banks.invoice_form.desc_placeholder')}
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
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="success"
              loading={loading}
            >
              {loading ? t('common.adding') : t('banks.invoice_form.create')}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}

export default BankInvoiceFormModal
