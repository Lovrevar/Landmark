import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../../ui'
import type { EquityFormData, BankWithCredits, Company } from '../types'
import { calculateEquityCashflow, calculateMoneyMultiple } from '../utils/creditCalculations'

interface EquityFormModalProps {
  show: boolean
  onClose: () => void
  banks: BankWithCredits[]
  companies: Company[]
  formData: EquityFormData
  onChange: (data: Partial<EquityFormData>) => void
  onSubmit: () => void
}

const EquityFormModal: React.FC<EquityFormModalProps> = ({
  show,
  onClose,
  banks,
  companies,
  formData,
  onChange,
  onSubmit,
}) => {
  const { t } = useTranslation()
  const cashflowValue = calculateEquityCashflow(formData)
  const moneyMultiple = calculateMoneyMultiple(formData)

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header title={t('funding.equity_form.title')} onClose={onClose} />
      <Modal.Body>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label={t('funding.equity_form.bank_label')} required>
            <Select
              value={formData.bank_id}
              onChange={(e) => onChange({ bank_id: e.target.value })}
            >
              <option value="">{t('funding.equity_form.select_bank')}</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('funding.equity_form.company_label')}>
            <Select
              value={formData.company_id}
              onChange={(e) => onChange({ company_id: e.target.value })}
            >
              <option value="">{t('funding.equity_form.select_company')}</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('funding.equity_form.amount_label')} required>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('funding.equity_form.irr_label')}>
            <Input
              type="number"
              step="0.1"
              value={formData.expected_return}
              onChange={(e) => onChange({ expected_return: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label={t('funding.equity_form.payment_schedule_label')}>
            <Select
              value={formData.payment_schedule}
              onChange={(e) => {
                const newSchedule = e.target.value as 'monthly' | 'yearly' | 'custom'
                onChange({
                  payment_schedule: newSchedule,
                  custom_payment_count: 0,
                  custom_payments: []
                })
              }}
            >
              <option value="yearly">{t('funding.equity_form.yearly_option')}</option>
              <option value="monthly">{t('funding.equity_form.monthly_option')}</option>
              <option value="custom">{t('funding.equity_form.custom_option')}</option>
            </Select>
          </FormField>

          {formData.payment_schedule === 'custom' && (
            <>
              <FormField label={t('funding.equity_form.num_payments_label')} required>
                <Input
                  type="number"
                  min="1"
                  value={formData.custom_payment_count || ''}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 0
                    const newPayments = Array.from({ length: count }, (_, i) =>
                      formData.custom_payments[i] || { date: '', amount: 0 }
                    )
                    onChange({
                      custom_payment_count: count,
                      custom_payments: newPayments
                    })
                  }}
                  placeholder={t('funding.equity_form.num_payments_placeholder')}
                />
              </FormField>

              {formData.custom_payment_count > 0 && (
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">{t('funding.equity_form.payment_schedule_details_heading')}</h4>
                  {formData.custom_payments.map((payment, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <FormField label={t('funding.equity_form.payment_date_label', { num: index + 1 })} required>
                        <Input
                          type="date"
                          value={payment.date}
                          onChange={(e) => {
                            const updatedPayments = [...formData.custom_payments]
                            updatedPayments[index] = { ...updatedPayments[index], date: e.target.value }
                            onChange({ custom_payments: updatedPayments })
                          }}
                        />
                      </FormField>
                      <FormField label={t('funding.equity_form.payment_amount_label', { num: index + 1 })} required>
                        <Input
                          type="number"
                          value={payment.amount || ''}
                          onChange={(e) => {
                            const updatedPayments = [...formData.custom_payments]
                            updatedPayments[index] = { ...updatedPayments[index], amount: parseFloat(e.target.value) || 0 }
                            onChange({ custom_payments: updatedPayments })
                          }}
                          placeholder={t('funding.equity_form.payment_amount_placeholder')}
                        />
                      </FormField>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {formData.payment_schedule !== 'custom' && (
            <FormField
              label={formData.payment_schedule === 'yearly' ? t('funding.equity_form.yearly_cashflow_label') : t('funding.equity_form.monthly_cashflow_label')}
              helperText={formData.payment_schedule === 'yearly' ? t('funding.equity_form.yearly_cashflow_helper') : t('funding.equity_form.monthly_cashflow_helper')}
            >
              <Input
                type="text"
                value={cashflowValue}
                readOnly
                className="bg-gray-50 dark:bg-gray-700/50"
              />
            </FormField>
          )}
          <FormField label={t('funding.equity_form.money_multiple_label')} helperText={t('funding.equity_form.money_multiple_helper')}>
            <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200">
              {moneyMultiple}
            </div>
          </FormField>
          <FormField label={t('funding.equity_form.investment_date_label')} required>
            <Input
              type="date"
              value={formData.investment_date}
              onChange={(e) => onChange({ investment_date: e.target.value })}
            />
          </FormField>
          <FormField label={t('funding.equity_form.exit_date_label')}>
            <Input
              type="date"
              value={formData.maturity_date}
              onChange={(e) => onChange({ maturity_date: e.target.value })}
            />
          </FormField>
          <FormField label={t('funding.equity_form.usage_expiration_label')}>
            <Input
              type="date"
              value={formData.usage_expiration_date}
              onChange={(e) => onChange({ usage_expiration_date: e.target.value })}
            />
          </FormField>
          <FormField label={t('funding.equity_form.grace_period_label')}>
            <Input
              type="number"
              value={formData.grace_period}
              onChange={(e) => onChange({ grace_period: parseInt(e.target.value) || 0 })}
              placeholder={t('funding.equity_form.grace_period_placeholder')}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label={t('funding.equity_form.mortgages_label')}>
              <Textarea
                value={formData.terms}
                onChange={(e) => onChange({ terms: e.target.value })}
                rows={3}
                placeholder={t('funding.equity_form.mortgages_placeholder')}
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label={t('funding.equity_form.notes_label')}>
              <Textarea
                value={formData.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                rows={3}
                placeholder={t('funding.equity_form.notes_placeholder')}
              />
            </FormField>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('funding.equity_form.cancel_button')}</Button>
        <Button variant="success" onClick={onSubmit}>
          {t('funding.equity_form.submit_button')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default EquityFormModal
