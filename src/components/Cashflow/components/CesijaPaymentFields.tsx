import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../Common/CurrencyInput'
import type { Company, CompanyBankAccount, CompanyCredit, CreditAllocation } from '../Invoices/types'
import { Select, FormField } from '../../ui'

interface CesijaFormData {
  is_cesija: boolean
  cesija_company_id: string
  cesija_bank_account_id: string
  cesija_credit_id?: string
  cesija_credit_allocation_id?: string
  payment_source_type: string
  [key: string]: unknown
}

interface CesijaPaymentFieldsProps {
  paymentFormData: CesijaFormData
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  companyCredits: CompanyCredit[]
  creditAllocations: CreditAllocation[]
  onFormChange: (data: CesijaFormData) => void
  onCreditChange: (creditId: string) => void
}

export const CesijaPaymentFields: React.FC<CesijaPaymentFieldsProps> = ({
  paymentFormData,
  companies,
  companyBankAccounts,
  companyCredits,
  creditAllocations,
  onFormChange,
  onCreditChange
}) => {
  const { t } = useTranslation()

  if (!paymentFormData.is_cesija) return null

  return (
    <>
      <FormField label={t('cesija_fields.payer_label')} required className="md:col-span-2">
        <Select
          value={paymentFormData.cesija_company_id}
          onChange={(e) => onFormChange({
            ...paymentFormData,
            cesija_company_id: e.target.value,
            cesija_bank_account_id: ''
          })}
        >
          <option value="">{t('cesija_fields.payer_placeholder')}</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </FormField>

      {paymentFormData.cesija_company_id && (
        <>
          <FormField label={t('cesija_fields.source_label')} required className="md:col-span-2">
            <Select
              value={paymentFormData.payment_source_type}
              onChange={(e) => onFormChange({
                ...paymentFormData,
                payment_source_type: e.target.value as 'bank_account' | 'credit',
                cesija_bank_account_id: '',
                cesija_credit_id: ''
              })}
            >
              <option value="bank_account">{t('cesija_fields.source_bank')}</option>
              <option value="credit">{t('cesija_fields.source_credit')}</option>
            </Select>
          </FormField>

          {paymentFormData.payment_source_type === 'bank_account' && (
            <FormField
              label={t('cesija_fields.bank_account_label')}
              required
              className="md:col-span-2"
              error={
                paymentFormData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === paymentFormData.cesija_company_id).length === 0
                  ? t('cesija_fields.no_bank_accounts_error')
                  : undefined
              }
            >
              <Select
                value={paymentFormData.cesija_bank_account_id}
                onChange={(e) => onFormChange({ ...paymentFormData, cesija_bank_account_id: e.target.value })}
              >
                <option value="">{t('cesija_fields.bank_account_placeholder')}</option>
                {companyBankAccounts
                  .filter(acc => acc.company_id === paymentFormData.cesija_company_id)
                  .map(account => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} ({t('cesija_fields.balance_label')}{formatCurrency(account.current_balance)})
                    </option>
                  ))}
              </Select>
            </FormField>
          )}

          {paymentFormData.payment_source_type === 'credit' && (
            <FormField
              label={t('cesija_fields.credit_label')}
              required
              className="md:col-span-2"
              error={
                paymentFormData.cesija_company_id && companyCredits.filter(credit =>
                  credit.company_id === paymentFormData.cesija_company_id &&
                  !credit.disbursed_to_account
                ).length === 0
                  ? t('cesija_fields.no_credits_error')
                  : undefined
              }
            >
              <Select
                value={paymentFormData.cesija_credit_id}
                onChange={(e) => {
                  const newCreditId = e.target.value
                  onFormChange({ ...paymentFormData, cesija_credit_id: newCreditId, cesija_credit_allocation_id: '' })
                  onCreditChange(newCreditId)
                }}
              >
                <option value="">{t('cesija_fields.credit_placeholder')}</option>
                {companyCredits
                  .filter(credit =>
                    credit.company_id === paymentFormData.cesija_company_id &&
                    !credit.disbursed_to_account
                  )
                  .map(credit => {
                    const available = credit.amount - credit.used_amount
                    return (
                      <option key={credit.id} value={credit.id}>
                        {credit.credit_name} ({t('cesija_fields.available_label')}{formatCurrency(available)})
                      </option>
                    )
                  })}
              </Select>
            </FormField>
          )}

          {paymentFormData.payment_source_type === 'credit' && paymentFormData.cesija_credit_id && (
            <FormField
              label={t('cesija_fields.project_label')}
              required
              className="md:col-span-2"
              error={
                creditAllocations.length === 0
                  ? t('cesija_fields.no_allocations_error')
                  : undefined
              }
            >
              <Select
                value={paymentFormData.cesija_credit_allocation_id}
                onChange={(e) => onFormChange({ ...paymentFormData, cesija_credit_allocation_id: e.target.value })}
              >
                <option value="">{t('cesija_fields.project_placeholder')}</option>
                {creditAllocations.map(allocation => {
                  const available = allocation.allocated_amount - allocation.used_amount
                  return (
                    <option key={allocation.id} value={allocation.id}>
                      {allocation.project?.name || t('cesija_fields.opex_label')} ({t('cesija_fields.available_label')}{formatCurrency(available)})
                    </option>
                  )
                })}
              </Select>
            </FormField>
          )}
        </>
      )}
    </>
  )
}
