import React from 'react'
import { useTranslation } from 'react-i18next'
import DateInput from '../../../Common/DateInput'
import { Payment, Invoice, Company, CompanyBankAccount, CompanyCredit, CreditAllocation, PaymentFormData } from '../types'
import { Modal, Button, Select, Input, Textarea, FormField, Form } from '../../../ui'
import CurrencyInput, { formatCurrency } from '../../../Common/CurrencyInput'
import { CesijaPaymentFields } from '../../components/CesijaPaymentFields'
import { PaymentMethodField } from '../../components/PaymentMethodField'
import { snapPaymentMethod } from '../../services/paymentHelpers'
import { getInvoiceTypeLabelKey } from '../../services/invoiceHelpers'
import { PaymentInvoiceSummary, PartialPaymentAlert } from './PaymentInvoiceSummary'

interface AccountingPaymentFormModalProps {
  showModal: boolean
  editingPayment: Payment | null
  formData: PaymentFormData
  setFormData: React.Dispatch<React.SetStateAction<PaymentFormData>>
  invoices: Invoice[]
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  companyCredits: CompanyCredit[]
  creditAllocations: CreditAllocation[]
  onCreditChange: (creditId: string) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const AccountingPaymentFormModal: React.FC<AccountingPaymentFormModalProps> = ({
  showModal,
  editingPayment,
  formData,
  setFormData,
  invoices,
  companies,
  companyBankAccounts,
  companyCredits,
  creditAllocations,
  onCreditChange,
  onClose,
  onSubmit
}) => {
  const { t } = useTranslation()
  // Shared with the invoice filters, so every type — including INCOMING_BANK_EXPENSES — has a label.
  const getInvoiceTypeLabel = (type: string) => {
    const key = getInvoiceTypeLabelKey(type)
    return key ? t(key) : type
  }

  const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
  // remaining_amount already has the edited payment subtracted, so it may cover that much again.
  const payableAmount = selectedInvoice
    ? selectedInvoice.remaining_amount + (editingPayment?.amount ?? 0)
    : 0
  const invoiceBankAccounts = selectedInvoice
    ? companyBankAccounts.filter(acc => acc.company_id === selectedInvoice.company_id)
    : []
  const invoiceCredits = selectedInvoice
    ? companyCredits.filter(credit => credit.company_id === selectedInvoice.company_id && !credit.disbursed_to_account)
    : []

  // Every change to the source or cesija goes through here, so the method can never be left on
  // one the new source does not allow (e.g. Gotovina recorded as a wire).
  const changeForm = (data: PaymentFormData) => setFormData({
    ...data,
    payment_method: snapPaymentMethod(data.payment_method, data.payment_source_type, data.is_cesija)
  })

  const getInvoiceEntityName = (invoice: Invoice) => {
    if (invoice.subcontractors?.name) return invoice.subcontractors.name
    if (invoice.customers) return `${invoice.customers.name} ${invoice.customers.surname}`
    if (invoice.office_suppliers?.name) return invoice.office_suppliers.name
    if (invoice.bank_company?.name) return invoice.bank_company.name
    if (invoice.retail_suppliers?.name) return invoice.retail_suppliers.name
    return ''
  }

  const formatInvoiceDisplay = (invoice: Invoice) => {
    const companyName = invoice.companies?.name || ''
    const entityName = getInvoiceEntityName(invoice)
    const typeLabel = getInvoiceTypeLabel(invoice.invoice_type)
    const remaining = `€${formatCurrency(invoice.remaining_amount)}`

    const parts = [invoice.invoice_number]
    if (typeLabel) parts.push(typeLabel)
    if (companyName) parts.push(companyName)
    if (entityName) parts.push(entityName)
    parts.push(`${t('payments.form.remaining_label')}${remaining}`)

    return parts.join(' - ')
  }

  return (
    <Modal show={showModal} onClose={onClose}>
      <Modal.Header
        title={editingPayment ? t('payments.form.title_edit') : t('payments.form.title_new')}
        onClose={onClose}
      />

      <Form onSubmit={onSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body>
          {selectedInvoice && <PaymentInvoiceSummary invoice={selectedInvoice} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('payments.form.invoice_label')} required className="md:col-span-2">
              <Select
                value={formData.invoice_id}
                onChange={(e) => {
                  const pickedInvoice = invoices.find(inv => inv.id === e.target.value)
                  setFormData({
                    ...formData,
                    invoice_id: e.target.value,
                    company_bank_account_id: '',
                    credit_id: '',
                    credit_allocation_id: '',
                    amount: pickedInvoice ? pickedInvoice.remaining_amount : 0
                  })
                }}
                disabled={!!editingPayment}
              >
                <option value="">{t('payments.form.select_invoice')}</option>
                {invoices.map(invoice => (
                  <option key={invoice.id} value={invoice.id}>
                    {formatInvoiceDisplay(invoice)}
                  </option>
                ))}
              </Select>
            </FormField>

            {formData.invoice_id && !formData.is_cesija && (
              <>
                <FormField label={t('payments.form.source_label')} required className="md:col-span-2">
                  <Select
                    value={formData.payment_source_type}
                    onChange={(e) => changeForm({
                      ...formData,
                      payment_source_type: e.target.value as 'bank_account' | 'credit' | 'kompenzacija' | 'gotovina',
                      company_bank_account_id: '',
                      credit_id: ''
                    })}
                  >
                    <option value="bank_account">{t('payments.form.source_bank')}</option>
                    <option value="credit">{t('payments.form.source_credit')}</option>
                    <option value="kompenzacija">{t('payments.form.source_kompenzacija')}</option>
                    <option value="gotovina">{t('payments.form.source_cash')}</option>
                  </Select>
                </FormField>

                {formData.payment_source_type === 'bank_account' && (
                  <FormField
                    label={t('payments.form.bank_account_label')}
                    required
                    className="md:col-span-2"
                    error={invoiceBankAccounts.length === 0 ? t('payments.form.no_bank_accounts_error') : undefined}
                  >
                    <Select
                      value={formData.company_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, company_bank_account_id: e.target.value })}
                    >
                      <option value="">{t('payments.form.select_bank_account')}</option>
                      {invoiceBankAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} ({t('payments.form.balance_label')}€{formatCurrency(account.current_balance)})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}

                {formData.payment_source_type === 'credit' && (
                  <FormField
                    label={t('payments.form.credit_label')}
                    required
                    className="md:col-span-2"
                    error={invoiceCredits.length === 0 ? t('payments.form.no_credits_error') : undefined}
                  >
                    <Select
                      value={formData.credit_id}
                      onChange={(e) => {
                        const newCreditId = e.target.value
                        setFormData({ ...formData, credit_id: newCreditId, credit_allocation_id: '' })
                        onCreditChange(newCreditId)
                      }}
                    >
                      <option value="">{t('payments.form.select_credit')}</option>
                      {invoiceCredits.map(credit => {
                        const available = credit.amount - credit.used_amount
                        return (
                          <option key={credit.id} value={credit.id}>
                            {credit.credit_name} ({t('payments.form.credit_available')}€{formatCurrency(available)})
                          </option>
                        )
                      })}
                    </Select>
                  </FormField>
                )}

                {formData.payment_source_type === 'credit' && formData.credit_id && (
                  <FormField
                    label={t('cesija_fields.project_label')}
                    required
                    className="md:col-span-2"
                    error={creditAllocations.length === 0 ? t('cesija_fields.no_allocations_error') : undefined}
                  >
                    <Select
                      value={formData.credit_allocation_id}
                      onChange={(e) => setFormData({ ...formData, credit_allocation_id: e.target.value })}
                    >
                      <option value="">{t('cesija_fields.project_placeholder')}</option>
                      {creditAllocations.map(allocation => {
                        const available = allocation.allocated_amount - allocation.used_amount
                        return (
                          <option key={allocation.id} value={allocation.id}>
                            {allocation.project?.name || t('cesija_fields.opex_label')} ({t('cesija_fields.available_label')}€{formatCurrency(available)})
                          </option>
                        )
                      })}
                    </Select>
                  </FormField>
                )}
              </>
            )}

            {formData.invoice_id && (
              <div className="md:col-span-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_cesija}
                    onChange={(e) => changeForm({
                      ...formData,
                      is_cesija: e.target.checked,
                      payment_source_type: e.target.checked ? 'bank_account' : formData.payment_source_type,
                      company_bank_account_id: e.target.checked ? '' : formData.company_bank_account_id,
                      credit_id: '',
                      credit_allocation_id: '',
                      cesija_company_id: '',
                      cesija_bank_account_id: '',
                      cesija_credit_id: '',
                      cesija_credit_allocation_id: ''
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t('payments.form.cesija_checkbox')}
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                  {t('payments.form.cesija_hint')}
                </p>
              </div>
            )}

            <CesijaPaymentFields
              paymentFormData={formData}
              companies={companies}
              companyBankAccounts={companyBankAccounts}
              companyCredits={companyCredits}
              creditAllocations={creditAllocations}
              onFormChange={(data) => changeForm({ ...formData, ...data } as PaymentFormData)}
              onCreditChange={onCreditChange}
            />

            <FormField label={t('payments.form.date_label')} required>
              <DateInput
                value={formData.payment_date}
                onChange={(value) => setFormData({ ...formData, payment_date: value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </FormField>

            <FormField
              label={t('payments.form.amount_label')}
              required
              helperText={selectedInvoice
                ? t('payments.form.max_amount_helper', { amount: formatCurrency(payableAmount) })
                : undefined}
            >
              <CurrencyInput
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                placeholder="0,00"
                min={0.01}
              />
            </FormField>

            <PaymentMethodField
              value={formData.payment_method}
              source={formData.payment_source_type}
              isCesija={formData.is_cesija}
              onChange={(method) => setFormData({ ...formData, payment_method: method })}
            />

            <FormField label={t('payments.form.reference_label')}>
              <Input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder={t('payments.form.reference_placeholder')}
              />
            </FormField>
          </div>

          <FormField label={t('payments.form.description_label')}>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder={t('invoices.form.additional_notes')}
            />
          </FormField>

          {selectedInvoice && <PartialPaymentAlert amount={formData.amount} payableAmount={payableAmount} />}
        </Modal.Body>
        <Modal.Footer sticky>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit">
            {editingPayment ? t('common.save_changes') : t('payments.form.create')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default AccountingPaymentFormModal
