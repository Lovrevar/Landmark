import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import DateInput from '../../../Common/DateInput'
import { BankWithCredits, Company, BankCredit, NewCreditForm, CompanyBankAccount } from '../bankTypes'
import { calculatePayments, fetchCompanyBankAccounts } from '../services/bankService'
import { Modal, Button, Select, Input, Textarea, FormField } from '../../../ui'

interface BankCreditFormModalProps {
  showCreditForm: boolean
  editingCredit: BankCredit | null
  newCredit: NewCreditForm
  setNewCredit: (credit: NewCreditForm) => void
  banks: BankWithCredits[]
  companies: Company[]
  addCredit: () => void
  resetCreditForm: () => void
}

const BankCreditFormModal: React.FC<BankCreditFormModalProps> = ({
  showCreditForm,
  editingCredit,
  newCredit,
  setNewCredit,
  banks,
  companies,
  addCredit,
  resetCreditForm
}) => {
  const { t } = useTranslation()
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (newCredit.company_id && newCredit.disbursed_to_account) {
      loadCompanyBankAccounts(newCredit.company_id)
    } else {
      setCompanyBankAccounts([])
    }
  }, [newCredit.company_id, newCredit.disbursed_to_account])

  const loadCompanyBankAccounts = async (companyId: string) => {
    try {
      setLoadingAccounts(true)
      const data = await fetchCompanyBankAccounts(companyId)
      setCompanyBankAccounts(data)
    } catch (error) {
      console.error('Error fetching company bank accounts:', error)
      setCompanyBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  if (!showCreditForm) return null

  const handleAddCredit = () => {
    const errors: Record<string, string> = {}
    if (!newCredit.bank_id) errors.bank_id = t('banks.credit_form.bank_required')
    if (!newCredit.credit_name.trim()) errors.credit_name = t('banks.credit_form.credit_name_required')
    if (!newCredit.amount) errors.amount = t('banks.credit_form.amount_required')
    if (!newCredit.start_date) errors.start_date = t('banks.credit_form.start_date_required')
    if (newCredit.disbursed_to_account && !newCredit.disbursed_to_bank_account_id) errors.disbursed_to_bank_account_id = t('banks.credit_form.bank_account_required')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    addCredit()
  }

  const calculation = calculatePayments(newCredit)

  return (
    <Modal show={showCreditForm} onClose={resetCreditForm} size="md">
      <Modal.Header
        title={editingCredit ? t('banks.credit_form.title_edit') : t('banks.credit_form.title_add')}
        onClose={resetCreditForm}
      />

      <Modal.Body>
        {calculation && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">{t('banks.credit_form.schedule_preview')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">{t('banks.credit_form.principal_payment')}</p>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100">€{calculation.principalPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">{t('banks.credit_form.every_freq', { frequency: calculation.principalFrequency })}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t('banks.credit_form.total_payments_label', { count: calculation.totalPrincipalPayments })}</p>
              </div>
              <div>
                <p className="text-sm text-green-700 dark:text-green-400 mb-1">{t('banks.credit_form.interest_payment')}</p>
                <p className="text-xl font-bold text-green-900 dark:text-green-200">€{calculation.interestPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-green-600 dark:text-green-400">{t('banks.credit_form.every_freq', { frequency: calculation.interestFrequency })}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('banks.credit_form.total_payments_label', { count: calculation.totalInterestPayments })}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-700 dark:text-blue-300">{t('banks.credit_form.payments_start_label')}<span className="font-semibold">{format(calculation.paymentStartDate, 'MMM dd, yyyy')}</span></p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t('banks.credit_form.grace_period_after', { months: newCredit.grace_period })}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label={t('banks.credit_form.bank_label')} required error={fieldErrors.bank_id}>
            <Select
              value={newCredit.bank_id}
              onChange={(e) => setNewCredit({ ...newCredit, bank_id: e.target.value })}
            >
              <option value="">{t('banks.credit_form.select_bank')}</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={t('banks.credit_form.credit_name_label')} required error={fieldErrors.credit_name}>
            <Input
              type="text"
              value={newCredit.credit_name}
              onChange={(e) => setNewCredit({ ...newCredit, credit_name: e.target.value })}
              placeholder="e.g., Kozara Construction Loan 2024"
            />
          </FormField>

          <FormField label={t('banks.credit_form.company_label')}>
            <Select
              value={newCredit.company_id}
              onChange={(e) => setNewCredit({ ...newCredit, company_id: e.target.value })}
            >
              <option value="">{t('banks.credit_form.select_company')}</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={t('banks.credit_form.loan_type_label')}>
            <Select
              value={newCredit.credit_type}
              onChange={(e) => setNewCredit({ ...newCredit, credit_type: e.target.value as NewCreditForm['credit_type'] })}
            >
              <option value="construction_loan_senior">{t('banks.credit_form.construction_loan')}</option>
              <option value="term_loan_senior">{t('banks.credit_form.term_loan')}</option>
              <option value="line_of_credit_senior">{t('banks.credit_form.loc_senior')}</option>
              <option value="line_of_credit_junior">{t('banks.credit_form.loc_junior')}</option>
              <option value="bridge_loan_senior">{t('banks.credit_form.bridge_loan')}</option>
            </Select>
          </FormField>

          <FormField label={t('banks.credit_form.amount_label')} required error={fieldErrors.amount}>
            <Input
              type="number"
              value={newCredit.amount}
              onChange={(e) => setNewCredit({ ...newCredit, amount: parseFloat(e.target.value) || 0 })}
            />
          </FormField>

          <FormField label={t('banks.credit_form.interest_rate_label')}>
            <Input
              type="number"
              step="0.1"
              value={newCredit.interest_rate}
              onChange={(e) => setNewCredit({ ...newCredit, interest_rate: parseFloat(e.target.value) || 0 })}
            />
          </FormField>

          <FormField label={t('banks.credit_form.grace_period_label')}>
            <Input
              type="number"
              value={newCredit.grace_period}
              onChange={(e) => setNewCredit({ ...newCredit, grace_period: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </FormField>

          <FormField label={t('banks.credit_form.principal_repayment_label')} helperText={t('banks.credit_form.principal_repayment_helper')}>
            <Select
              value={newCredit.principal_repayment_type}
              onChange={(e) => setNewCredit({ ...newCredit, principal_repayment_type: e.target.value as NewCreditForm['principal_repayment_type'] })}
            >
              <option value="monthly">{t('banks.credit_form.monthly')}</option>
              <option value="quarterly">{t('banks.credit_form.quarterly')}</option>
              <option value="biyearly">{t('banks.credit_form.biyearly')}</option>
              <option value="yearly">{t('banks.credit_form.yearly')}</option>
            </Select>
          </FormField>

          <FormField label={t('banks.credit_form.interest_repayment_label')} helperText={t('banks.credit_form.interest_repayment_helper')}>
            <Select
              value={newCredit.interest_repayment_type}
              onChange={(e) => setNewCredit({ ...newCredit, interest_repayment_type: e.target.value as NewCreditForm['interest_repayment_type'] })}
            >
              <option value="monthly">{t('banks.credit_form.monthly')}</option>
              <option value="quarterly">{t('banks.credit_form.quarterly')}</option>
              <option value="biyearly">{t('banks.credit_form.biyearly')}</option>
              <option value="yearly">{t('banks.credit_form.yearly')}</option>
            </Select>
          </FormField>

          <FormField label={t('banks.credit_form.start_date_label')} required error={fieldErrors.start_date}>
            <DateInput
              value={newCredit.start_date}
              onChange={(value) => setNewCredit({ ...newCredit, start_date: value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField label={t('banks.credit_form.maturity_date_label')}>
            <DateInput
              value={newCredit.maturity_date}
              onChange={(value) => setNewCredit({ ...newCredit, maturity_date: value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField label={t('banks.credit_form.usage_expiration_label')}>
            <DateInput
              value={newCredit.usage_expiration_date || ''}
              onChange={(value) => setNewCredit({ ...newCredit, usage_expiration_date: value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField label={t('banks.credit_form.purpose_label')} className="md:col-span-2">
            <Textarea
              value={newCredit.purpose}
              onChange={(e) => setNewCredit({ ...newCredit, purpose: e.target.value })}
              rows={3}
              placeholder={t('banks.credit_form.purpose_placeholder')}
            />
          </FormField>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newCredit.disbursed_to_account || false}
                onChange={(e) => {
                  const checked = e.target.checked
                  setNewCredit({
                    ...newCredit,
                    disbursed_to_account: checked,
                    disbursed_to_bank_account_id: checked ? newCredit.disbursed_to_bank_account_id : undefined
                  })
                }}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900 dark:text-white">{t('banks.credit_form.disbursed_to_account_label')}</span>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t('banks.credit_form.disbursed_to_account_hint')}
                </p>
              </div>
            </label>

            {newCredit.disbursed_to_account && (
              <div className="mt-4">
                {!newCredit.company_id ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">{t('banks.credit_form.select_company_first')}</p>
                  </div>
                ) : loadingAccounts ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('banks.credit_form.loading_accounts')}</p>
                  </div>
                ) : companyBankAccounts.length === 0 ? (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-800 dark:text-red-300">{t('banks.credit_form.no_bank_accounts')}</p>
                  </div>
                ) : (
                  <FormField label={t('banks.credit_form.bank_account_label')} required error={fieldErrors.disbursed_to_bank_account_id}>
                    <Select
                      value={newCredit.disbursed_to_bank_account_id || ''}
                      onChange={(e) => setNewCredit({ ...newCredit, disbursed_to_bank_account_id: e.target.value })}
                    >
                      <option value="">{t('banks.credit_form.select_account')}</option>
                      {companyBankAccounts.map(account => (
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
        <Button variant="secondary" onClick={resetCreditForm}>
          {t('banks.credit_form.cancel_button')}
        </Button>
        <Button variant="success" onClick={handleAddCredit}>
          {t('banks.credit_form.add_button')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default BankCreditFormModal
