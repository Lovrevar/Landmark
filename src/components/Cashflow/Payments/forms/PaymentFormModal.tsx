import React from 'react'
import { useTranslation } from 'react-i18next'
import DateInput from '../../../Common/DateInput'
import CurrencyInput, { formatCurrency } from '../../../Common/CurrencyInput'
import { CesijaPaymentFields } from '../../components/CesijaPaymentFields'
import { PaymentMethodField } from '../../components/PaymentMethodField'
import { snapPaymentMethod } from '../../services/paymentHelpers'
import { PaymentInvoiceSummary, PartialPaymentAlert } from './PaymentInvoiceSummary'
import { Modal, Button, Input, Select, Textarea, FormField, Form } from '../../../ui'
import type { Invoice, Company, CompanyBankAccount, CompanyCredit, CreditAllocation } from '../../Invoices/types'

interface PaymentModalFormData {
  payment_source_type: string
  company_bank_account_id: string
  credit_id: string
  credit_allocation_id?: string
  is_cesija: boolean
  cesija_company_id: string
  cesija_bank_account_id: string
  cesija_credit_id?: string
  cesija_credit_allocation_id?: string
  payment_date: string
  amount: number
  payment_method: string
  reference_number: string
  description: string
  [key: string]: unknown
}

interface PaymentFormModalProps {
  show: boolean
  payingInvoice: Invoice | null
  paymentFormData: PaymentModalFormData
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  companyCredits: CompanyCredit[]
  creditAllocations: CreditAllocation[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onFormChange: (data: PaymentModalFormData) => void
  onCreditChange: (creditId: string) => void
}

export const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
  show,
  payingInvoice,
  paymentFormData,
  companies,
  companyBankAccounts,
  companyCredits,
  creditAllocations,
  onClose,
  onSubmit,
  onFormChange,
  onCreditChange
}) => {
  const { t } = useTranslation()
  if (!show || !payingInvoice) return null

  // Every change to the source or cesija goes through here, so the method can never be left on
  // one the new source does not allow (e.g. Gotovina recorded as a wire).
  const changeForm = (data: PaymentModalFormData) => onFormChange({
    ...data,
    payment_method: snapPaymentMethod(data.payment_method, data.payment_source_type, data.is_cesija)
  })

  return (
    <Modal show={show} onClose={onClose} size="sm">
      <Modal.Header
        title={t('payments.form.pay_invoice_title', { number: payingInvoice.invoice_number })}
        onClose={onClose}
      />

      <Form onSubmit={onSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body>
          <PaymentInvoiceSummary invoice={payingInvoice} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!paymentFormData.is_cesija && (
              <>
                <FormField label={payingInvoice.invoice_type.startsWith('OUTGOING') ? t('payments.form.source_incoming_label') : t('payments.form.source_outgoing_label')} required className="md:col-span-2">
                  <Select
                    value={paymentFormData.payment_source_type}
                    onChange={(e) => changeForm({
                      ...paymentFormData,
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

                {paymentFormData.payment_source_type === 'bank_account' && (
                  <FormField
                    label={t('payments.form.bank_account_label')}
                    required
                    className="md:col-span-2"
                    error={companyBankAccounts.filter(acc => acc.company_id === payingInvoice.company_id).length === 0
                      ? t('payments.form.no_bank_accounts_error')
                      : undefined}
                  >
                    <Select
                      value={paymentFormData.company_bank_account_id}
                      onChange={(e) => onFormChange({ ...paymentFormData, company_bank_account_id: e.target.value })}
                    >
                      <option value="">{t('payments.form.select_bank_account')}</option>
                      {companyBankAccounts
                        .filter(acc => acc.company_id === payingInvoice.company_id)
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} ({t('payments.form.balance_label')}€{formatCurrency(account.current_balance)})
                          </option>
                        ))}
                    </Select>
                  </FormField>
                )}

                {paymentFormData.payment_source_type === 'credit' && (
                  <FormField
                    label={t('payments.form.credit_label')}
                    required
                    className="md:col-span-2"
                    error={companyCredits.filter(credit =>
                      credit.company_id === payingInvoice.company_id &&
                      !credit.disbursed_to_account
                    ).length === 0
                      ? t('payments.form.no_credits_error')
                      : undefined}
                  >
                    <Select
                      value={paymentFormData.credit_id}
                      onChange={(e) => {
                        const newCreditId = e.target.value
                        onFormChange({ ...paymentFormData, credit_id: newCreditId, credit_allocation_id: '' })
                        onCreditChange(newCreditId)
                      }}
                    >
                      <option value="">{t('payments.form.select_credit')}</option>
                      {companyCredits
                        .filter(credit =>
                          credit.company_id === payingInvoice.company_id &&
                          !credit.disbursed_to_account
                        )
                        .map(credit => {
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

                {paymentFormData.payment_source_type === 'credit' && paymentFormData.credit_id && (
                  <FormField
                    label={t('cesija_fields.project_label')}
                    required
                    className="md:col-span-2"
                    error={creditAllocations.length === 0
                      ? t('cesija_fields.no_allocations_error')
                      : undefined}
                  >
                    <Select
                      value={paymentFormData.credit_allocation_id}
                      onChange={(e) => onFormChange({ ...paymentFormData, credit_allocation_id: e.target.value })}
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

            <div className="md:col-span-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentFormData.is_cesija}
                  onChange={(e) => changeForm({
                    ...paymentFormData,
                    is_cesija: e.target.checked,
                    // Cesija only funds from a bank account or a credit. Without this reset a
                    // Kompenzacija/Gotovina source survived the tick and the payment saved with no
                    // account at all. Same reset as AccountingPaymentFormModal.
                    payment_source_type: e.target.checked ? 'bank_account' : paymentFormData.payment_source_type,
                    company_bank_account_id: e.target.checked ? '' : paymentFormData.company_bank_account_id,
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

            <CesijaPaymentFields
              paymentFormData={paymentFormData}
              companies={companies}
              companyBankAccounts={companyBankAccounts}
              companyCredits={companyCredits}
              creditAllocations={creditAllocations}
              onFormChange={(data) => changeForm({ ...paymentFormData, ...data } as PaymentModalFormData)}
              onCreditChange={onCreditChange}
            />

            <FormField label={t('payments.form.date_label')} required>
              <DateInput
                value={paymentFormData.payment_date}
                onChange={(value) => onFormChange({ ...paymentFormData, payment_date: value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </FormField>

            <FormField label={t('payments.form.amount_label')} required helperText={t('payments.form.max_amount_helper', { amount: formatCurrency(payingInvoice.remaining_amount) })}>
              <CurrencyInput
                value={paymentFormData.amount}
                onChange={(value) => onFormChange({ ...paymentFormData, amount: value })}
                placeholder="0,00"
                min={0.01}
              />
            </FormField>

            <PaymentMethodField
              value={paymentFormData.payment_method}
              source={paymentFormData.payment_source_type}
              isCesija={paymentFormData.is_cesija}
              onChange={(method) => onFormChange({ ...paymentFormData, payment_method: method })}
            />

            <FormField label={t('payments.form.reference_label')}>
              <Input
                type="text"
                value={paymentFormData.reference_number}
                onChange={(e) => onFormChange({ ...paymentFormData, reference_number: e.target.value })}
                placeholder={t('payments.form.reference_placeholder')}
              />
            </FormField>
          </div>

          <FormField label={t('payments.form.description_label')}>
            <Textarea
              value={paymentFormData.description}
              onChange={(e) => onFormChange({ ...paymentFormData, description: e.target.value })}
              rows={3}
              placeholder={t('invoices.form.additional_notes')}
            />
          </FormField>

          <PartialPaymentAlert amount={paymentFormData.amount} payableAmount={payingInvoice.remaining_amount} />
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="success" type="submit">
            {t('payments.form.confirm_payment')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
