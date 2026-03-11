import React from 'react'
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
      <Modal.Header title={editingCredit ? 'Edit Credit Facility' : 'Add New Credit Facility'} onClose={onClose} />
      <Modal.Body>
        <PaymentSchedulePreview calculation={calculation} gracePeriodMonths={formData.grace_period} />

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
          <FormField label="Credit Name" required>
            <Input
              type="text"
              value={formData.credit_name}
              onChange={(e) => onChange({ credit_name: e.target.value })}
              placeholder="e.g., Kozara Construction Loan 2024"
            />
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
          <FormField label="Loan Type">
            <Select
              value={formData.credit_type}
              onChange={(e) => onChange({ credit_type: e.target.value })}
            >
              <option value="construction_loan_senior">Construction Loan</option>
              <option value="term_loan_senior">Term Loan</option>
              <option value="line_of_credit_senior">Line of Credit - Senior</option>
              <option value="line_of_credit_junior">Line of Credit - Junior</option>
              <option value="bridge_loan_senior">Bridge Loan</option>
            </Select>
          </FormField>
          <FormField label="Amount" required>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="Interest Rate (%)">
            <Input
              type="number"
              step="0.1"
              value={formData.interest_rate}
              onChange={(e) => onChange({ interest_rate: parseFloat(e.target.value) || 0 })}
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
          <FormField label="Principal Repayment Type" helperText="How often to repay principal">
            <Select
              value={formData.principal_repayment_type}
              onChange={(e) => onChange({ principal_repayment_type: e.target.value as 'monthly' | 'quarterly' | 'biyearly' | 'yearly' })}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biyearly">Biyearly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </FormField>
          <FormField label="Interest Repayment Type" helperText="How often to pay interest">
            <Select
              value={formData.interest_repayment_type}
              onChange={(e) => onChange({ interest_repayment_type: e.target.value as 'monthly' | 'quarterly' | 'biyearly' | 'yearly' })}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biyearly">Biyearly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </FormField>
          <FormField label="Start Date" required>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => onChange({ start_date: e.target.value })}
            />
          </FormField>
          <FormField label="Maturity Date">
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
          <div className="md:col-span-2">
            <FormField label="Purpose">
              <Textarea
                value={formData.purpose}
                onChange={(e) => onChange({ purpose: e.target.value })}
                rows={3}
                placeholder="What is this credit facility for?"
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
                <span className="font-medium text-gray-900">Isplata na račun</span>
                <p className="text-sm text-gray-600 mt-1">
                  Kada je označeno, ceo iznos kredita će automatski biti isplaćen na odabrani bankovni račun firme.
                </p>
              </div>
            </label>

            {formData.disbursed_to_account && (
              <div className="mt-4">
                {!formData.company_id ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">Molimo prvo odaberite firmu da biste videli dostupne bankovne račune.</p>
                  </div>
                ) : loadingAccounts ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600">Učitavanje računa...</p>
                  </div>
                ) : companyBankAccounts.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">Odabrana firma nema bankovnih računa. Molimo dodajte račun u "Moje firme" prvo.</p>
                  </div>
                ) : (
                  <FormField label="Bankovni račun" required>
                    <Select
                      value={formData.disbursed_to_bank_account_id}
                      onChange={(e) => onChange({ disbursed_to_bank_account_id: e.target.value })}
                      required={formData.disbursed_to_account}
                    >
                      <option value="">Odaberite račun</option>
                      {companyBankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name || 'Nepoznata banka'} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{Number(account.current_balance).toLocaleString('hr-HR')})
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
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="success" onClick={onSubmit}>
          {editingCredit ? 'Update' : 'Add'} Credit
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default CreditFormModal
