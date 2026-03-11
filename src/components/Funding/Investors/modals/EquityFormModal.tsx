import React from 'react'
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
  const cashflowValue = calculateEquityCashflow(formData)
  const moneyMultiple = calculateMoneyMultiple(formData)

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header title="Add New Investment" onClose={onClose} />
      <Modal.Body>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Bank" required>
            <Select
              value={formData.bank_id}
              onChange={(e) => onChange({ bank_id: e.target.value })}
            >
              <option value="">Select bank</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Company">
            <Select
              value={formData.company_id}
              onChange={(e) => onChange({ company_id: e.target.value })}
            >
              <option value="">Select company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Amount" required>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="IRR (%)">
            <Input
              type="number"
              step="0.1"
              value={formData.expected_return}
              onChange={(e) => onChange({ expected_return: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="Payment Schedule">
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
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </Select>
          </FormField>

          {formData.payment_schedule === 'custom' && (
            <>
              <FormField label="Number of Payments" required>
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
                  placeholder="Enter number of payments"
                />
              </FormField>

              {formData.custom_payment_count > 0 && (
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-medium text-gray-900">Payment Schedule Details</h4>
                  {formData.custom_payments.map((payment, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <FormField label={`Payment ${index + 1} - Date`} required>
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
                      <FormField label={`Payment ${index + 1} - Amount`} required>
                        <Input
                          type="number"
                          value={payment.amount || ''}
                          onChange={(e) => {
                            const updatedPayments = [...formData.custom_payments]
                            updatedPayments[index] = { ...updatedPayments[index], amount: parseFloat(e.target.value) || 0 }
                            onChange({ custom_payments: updatedPayments })
                          }}
                          placeholder="Amount"
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
              label={`${formData.payment_schedule === 'yearly' ? 'Yearly' : 'Monthly'} Cashflow`}
              helperText={`${formData.payment_schedule === 'yearly' ? 'Annual' : 'Monthly'} payment amount based on IRR and investment period minus grace period`}
            >
              <Input
                type="text"
                value={cashflowValue}
                readOnly
                className="bg-gray-50"
              />
            </FormField>
          )}
          <FormField label="Money Multiple" helperText="Total return multiple">
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
              {moneyMultiple}
            </div>
          </FormField>
          <FormField label="Investment Date" required>
            <Input
              type="date"
              value={formData.investment_date}
              onChange={(e) => onChange({ investment_date: e.target.value })}
            />
          </FormField>
          <FormField label="Exit Date">
            <Input
              type="date"
              value={formData.maturity_date}
              onChange={(e) => onChange({ maturity_date: e.target.value })}
            />
          </FormField>
          <FormField label="Usage Expiration Date">
            <Input
              type="date"
              value={formData.usage_expiration_date}
              onChange={(e) => onChange({ usage_expiration_date: e.target.value })}
            />
          </FormField>
          <FormField label="Grace Period (months)">
            <Input
              type="number"
              value={formData.grace_period}
              onChange={(e) => onChange({ grace_period: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Mortgages">
              <Textarea
                value={formData.terms}
                onChange={(e) => onChange({ terms: e.target.value })}
                rows={3}
                placeholder="Terms and conditions of the investment..."
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Notes">
              <Textarea
                value={formData.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                rows={3}
                placeholder="Additional notes about this investment..."
              />
            </FormField>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="success" onClick={onSubmit}>
          Add Investment
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default EquityFormModal
