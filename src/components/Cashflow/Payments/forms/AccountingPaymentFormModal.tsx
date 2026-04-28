import React from 'react'
import { useTranslation } from 'react-i18next'
import DateInput from '../../../Common/DateInput'
import { Payment, Invoice, Company, CompanyBankAccount, CompanyCredit, PaymentFormData } from '../types'
import { Modal, Button, Select, Input, Textarea, FormField, Form } from '../../../ui'

interface AccountingPaymentFormModalProps {
  showModal: boolean
  editingPayment: Payment | null
  formData: PaymentFormData
  setFormData: React.Dispatch<React.SetStateAction<PaymentFormData>>
  invoices: Invoice[]
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  companyCredits: CompanyCredit[]
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
  onClose,
  onSubmit
}) => {
  const { t } = useTranslation()
  const getInvoiceTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'INCOMING_SUPPLIER': t('payments.detail.type_incoming_supplier'),
      'INCOMING_INVESTMENT': t('payments.detail.type_incoming_investment'),
      'OUTGOING_SUPPLIER': t('payments.detail.type_outgoing_supplier'),
      'OUTGOING_SALES': t('payments.detail.type_outgoing_sales'),
      'INCOMING_OFFICE': t('payments.detail.type_incoming_office'),
      'OUTGOING_OFFICE': t('payments.detail.type_outgoing_office'),
      'INCOMING_BANK': t('payments.detail.type_incoming_bank'),
      'OUTGOING_BANK': t('payments.detail.type_outgoing_bank')
    }
    return typeMap[type] || type
  }

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
    const remaining = `€${invoice.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('payments.form.invoice_label')} required className="md:col-span-2">
              <Select
                value={formData.invoice_id}
                onChange={(e) => {
                  const selectedInvoice = invoices.find(inv => inv.id === e.target.value)
                  setFormData({
                    ...formData,
                    invoice_id: e.target.value,
                    company_bank_account_id: '',
                    amount: selectedInvoice ? selectedInvoice.remaining_amount : 0
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
                    onChange={(e) => setFormData({
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
                    error={
                      formData.invoice_id && companyBankAccounts.filter(acc => {
                        const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                        return selectedInvoice && acc.company_id === selectedInvoice.company_id
                      }).length === 0
                        ? t('payments.form.no_bank_accounts_error')
                        : undefined
                    }
                  >
                    <Select
                      value={formData.company_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, company_bank_account_id: e.target.value })}
                    >
                      <option value="">{t('payments.form.select_bank_account')}</option>
                      {companyBankAccounts
                        .filter(acc => {
                          const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                          return selectedInvoice && acc.company_id === selectedInvoice.company_id
                        })
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.bank_name} ({t('payments.form.balance_label')}€{account.current_balance.toLocaleString('hr-HR')})
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
                    error={
                      formData.invoice_id && companyCredits.filter(credit => {
                        const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                        return selectedInvoice &&
                          credit.company_id === selectedInvoice.company_id &&
                          !credit.disbursed_to_account
                      }).length === 0
                        ? t('payments.form.no_credits_error')
                        : undefined
                    }
                  >
                    <Select
                      value={formData.credit_id}
                      onChange={(e) => setFormData({ ...formData, credit_id: e.target.value })}
                    >
                      <option value="">{t('payments.form.select_credit')}</option>
                      {companyCredits
                        .filter(credit => {
                          const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                          return selectedInvoice &&
                            credit.company_id === selectedInvoice.company_id &&
                            !credit.disbursed_to_account
                        })
                        .map(credit => {
                          const available = credit.amount - credit.used_amount
                          return (
                            <option key={credit.id} value={credit.id}>
                              {credit.credit_name} ({t('payments.form.credit_available')}€{available.toLocaleString('hr-HR')})
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
                    onChange={(e) => setFormData({
                      ...formData,
                      is_cesija: e.target.checked,
                      company_bank_account_id: e.target.checked ? '' : formData.company_bank_account_id,
                      cesija_company_id: '',
                      cesija_bank_account_id: ''
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

            {formData.is_cesija && (
              <>
                <FormField label={t('payments.form.cesija_company_label')} required className="md:col-span-2">
                  <Select
                    value={formData.cesija_company_id}
                    onChange={(e) => setFormData({
                      ...formData,
                      cesija_company_id: e.target.value,
                      cesija_bank_account_id: ''
                    })}
                  >
                    <option value="">{t('payments.form.select_cesija_company')}</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {formData.cesija_company_id && (
                  <FormField
                    label={t('payments.form.cesija_bank_label')}
                    required
                    className="md:col-span-2"
                    error={
                      formData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === formData.cesija_company_id).length === 0
                        ? t('payments.form.no_bank_accounts_error')
                        : undefined
                    }
                  >
                    <Select
                      value={formData.cesija_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, cesija_bank_account_id: e.target.value })}
                    >
                      <option value="">{t('payments.form.select_bank_account')}</option>
                      {companyBankAccounts
                        .filter(acc => acc.company_id === formData.cesija_company_id)
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.bank_name} ({t('payments.form.balance_label')}€{account.current_balance.toLocaleString('hr-HR')})
                          </option>
                        ))}
                    </Select>
                  </FormField>
                )}
              </>
            )}

            <FormField label={t('payments.form.date_label')} required>
              <DateInput
                value={formData.payment_date}
                onChange={(value) => setFormData({ ...formData, payment_date: value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </FormField>

            <FormField label={t('payments.form.amount_label')} required>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              />
            </FormField>

            <FormField label={t('payments.form.method_label')} required>
              <Select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as 'WIRE' | 'CASH' | 'CHECK' | 'CARD' })}
              >
                <option value="WIRE">{t('payments.method_wire')}</option>
                <option value="CASH">{t('payments.method_cash')}</option>
                <option value="CHECK">{t('payments.method_check')}</option>
                <option value="CARD">{t('payments.method_card')}</option>
              </Select>
            </FormField>

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
