import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../../ui'
import type { BankCredit } from '../../../../lib/supabase'
import type { CreditFormData, CompanyBankAccount, BankWithCredits, Company } from '../types'
import { calculatePaymentSchedule } from '../utils/creditCalculations'
import PaymentSchedulePreview from '../components/PaymentSchedulePreview'

interface CreditFormModalProps {
  show: boolean
  onClose: () => void
  editingCredit: BankCredit | null
  banks: BankWithCredits[]
  companies: Company[]
  companyBankAccounts: CompanyBankAccount[]
  loadingAccounts: boolean
  formData: CreditFormData
  onChange: (data: Partial<CreditFormData>) => void
  onSubmit: () => void
}

const CreditFormModal: React.FC<CreditFormModalProps> = ({
  show,
  onClose,
  editingCredit,
  banks,
  companies,
  companyBankAccounts,
  loadingAccounts,
  formData,
  onChange,
  onSubmit,
}) => {
  const { t } = useTranslation()
  const calculation = calculatePaymentSchedule({
    start_date: formData.start_date,
    maturity_date: formData.maturity_date,
    amount: formData.amount,
    grace_period: formData.grace_period,
    interest_rate: formData.interest_rate,
    principal_repayment_type: formData.principal_repayment_type,
    interest_repayment_type: formData.interest_repayment_type,
  })

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header title={editingCredit ? t('banks.credit_form.title_edit') : t('banks.credit_form.title_add')} onClose={onClose} />
      <Modal.Body>
        <PaymentSchedulePreview calculation={calculation} gracePeriodMonths={formData.grace_period} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label={t('banks.credit_form.bank_label')} required>
            <Select
              value={formData.bank_id}
              onChange={(e) => onChange({ bank_id: e.target.value })}
            >
              <option value="">{t('banks.credit_form.select_bank')}</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('banks.credit_form.credit_name_label')} required>
            <Input
              type="text"
              value={formData.credit_name}
              onChange={(e) => onChange({ credit_name: e.target.value })}
              placeholder="e.g., Kozara Construction Loan 2024"
            />
          </FormField>
          <FormField label={t('banks.credit_form.company_label')}>
            <Select
              value={formData.company_id}
              onChange={(e) => onChange({ company_id: e.target.value })}
            >
              <option value="">{t('banks.credit_form.select_company')}</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('banks.credit_form.loan_type_label')}>
            <Select
              value={formData.credit_type}
              onChange={(e) => onChange({ credit_type: e.target.value })}
            >
              <option value="construction_loan_senior">{t('banks.credit_form.construction_loan')}</option>
              <option value="term_loan_senior">{t('banks.credit_form.term_loan')}</option>
              <option value="line_of_credit_senior">{t('banks.credit_form.loc_senior')}</option>
              <option value="line_of_credit_junior">{t('banks.credit_form.loc_junior')}</option>
              <option value="bridge_loan_senior">{t('banks.credit_form.bridge_loan')}</option>
            </Select>
          </FormField>
          <FormField label={t('banks.credit_form.amount_label')} required>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('banks.credit_form.interest_rate_label')}>
            <Input
              type="number"
              step="0.1"
              value={formData.interest_rate}
              onChange={(e) => onChange({ interest_rate: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('banks.credit_form.grace_period_label')}>
            <Input
              type="number"
              value={formData.grace_period}
              onChange={(e) => onChange({ grace_period: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </FormField>
          <FormField label={t('banks.credit_form.principal_repayment_label')} helperText={t('banks.credit_form.principal_repayment_helper')}>
            <Select
              value={formData.principal_repayment_type}
              onChange={(e) => onChange({ principal_repayment_type: e.target.value as 'monthly' | 'quarterly' | 'biyearly' | 'yearly' })}
            >
              <option value="monthly">{t('banks.credit_form.monthly')}</option>
              <option value="quarterly">{t('banks.credit_form.quarterly')}</option>
              <option value="biyearly">{t('banks.credit_form.biyearly')}</option>
              <option value="yearly">{t('banks.credit_form.yearly')}</option>
            </Select>
          </FormField>
          <FormField label={t('banks.credit_form.interest_repayment_label')} helperText={t('banks.credit_form.interest_repayment_helper')}>
            <Select
              value={formData.interest_repayment_type}
              onChange={(e) => onChange({ interest_repayment_type: e.target.value as 'monthly' | 'quarterly' | 'biyearly' | 'yearly' })}
            >
              <option value="monthly">{t('banks.credit_form.monthly')}</option>
              <option value="quarterly">{t('banks.credit_form.quarterly')}</option>
              <option value="biyearly">{t('banks.credit_form.biyearly')}</option>
              <option value="yearly">{t('banks.credit_form.yearly')}</option>
            </Select>
          </FormField>
          <FormField label={t('banks.credit_form.start_date_label')} required>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => onChange({ start_date: e.target.value })}
            />
          </FormField>
          <FormField label={t('banks.credit_form.maturity_date_label')}>
            <Input
              type="date"
              value={formData.maturity_date}
              onChange={(e) => onChange({ maturity_date: e.target.value })}
            />
          </FormField>
          <FormField label={t('banks.credit_form.usage_expiration_label')}>
            <Input
              type="date"
              value={formData.usage_expiration_date}
              onChange={(e) => onChange({ usage_expiration_date: e.target.value })}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label={t('banks.credit_form.purpose_label')}>
              <Textarea
                value={formData.purpose}
                onChange={(e) => onChange({ purpose: e.target.value })}
                rows={3}
                placeholder={t('banks.credit_form.purpose_placeholder')}
              />
            </FormField>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="bg-blue-50 p-4 rounded-lg">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.disbursed_to_account}
                onChange={(e) => {
                  const checked = e.target.checked
                  onChange({
                    disbursed_to_account: checked,
                    disbursed_to_bank_account_id: checked ? formData.disbursed_to_bank_account_id : ''
                  })
                }}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">{t('banks.credit_form.disbursed_to_account_label')}</span>
                <p className="text-sm text-gray-600 mt-1">
                  {t('banks.credit_form.disbursed_to_account_hint')}
                </p>
              </div>
            </label>

            {formData.disbursed_to_account && (
              <div className="mt-4">
                {!formData.company_id ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">{t('banks.credit_form.select_company_first')}</p>
                  </div>
                ) : loadingAccounts ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600">{t('banks.credit_form.loading_accounts')}</p>
                  </div>
                ) : companyBankAccounts.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{t('banks.credit_form.no_bank_accounts')}</p>
                  </div>
                ) : (
                  <FormField label={t('banks.credit_form.bank_account_label')} required>
                    <Select
                      value={formData.disbursed_to_bank_account_id}
                      onChange={(e) => onChange({ disbursed_to_bank_account_id: e.target.value })}
                    >
                      <option value="">{t('banks.credit_form.select_account')}</option>
                      {companyBankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name || t('banks.credit_form.unknown_bank')} {account.account_number ? `- ${account.account_number}` : ''} ({t('banks.credit_form.balance_label')}€{Number(account.current_balance).toLocaleString('hr-HR')})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="success" onClick={onSubmit}>
          {editingCredit ? t('common.update') : t('common.add')} {t('common.contract')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default CreditFormModal
