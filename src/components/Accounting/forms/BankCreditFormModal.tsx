import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import DateInput from '../../Common/DateInput'
import { BankWithCredits, Company, BankCredit, NewCreditForm, CompanyBankAccount } from '../types/bankTypes'
import { calculatePayments } from '../services/bankService'
import { Modal, Button, Select, Input, Textarea, FormField } from '../../ui'
import { supabase } from '../../../lib/supabase'

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
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  useEffect(() => {
    if (newCredit.company_id && newCredit.disbursed_to_account) {
      fetchCompanyBankAccounts(newCredit.company_id)
    } else {
      setCompanyBankAccounts([])
    }
  }, [newCredit.company_id, newCredit.disbursed_to_account])

  const fetchCompanyBankAccounts = async (companyId: string) => {
    try {
      setLoadingAccounts(true)
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select(`
          id,
          company_id,
          bank_name,
          account_number,
          current_balance
        `)
        .eq('company_id', companyId)

      if (error) throw error
      setCompanyBankAccounts(data || [])
    } catch (error) {
      console.error('Error fetching company bank accounts:', error)
      setCompanyBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  if (!showCreditForm) return null

  const calculation = calculatePayments(newCredit)

  return (
    <Modal show={showCreditForm} onClose={resetCreditForm} size="md">
      <Modal.Header
        title={editingCredit ? 'Edit Credit Facility' : 'Add New Credit Facility'}
        onClose={resetCreditForm}
      />

      <Modal.Body>
        {calculation && (
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-3">Payment Schedule Preview</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700 mb-1">Principal Payment</p>
                <p className="text-xl font-bold text-blue-900">€{calculation.principalPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-blue-600">Every {calculation.principalFrequency}</p>
                <p className="text-xs text-blue-600 mt-1">{calculation.totalPrincipalPayments} total payments</p>
              </div>
              <div>
                <p className="text-sm text-green-700 mb-1">Interest Payment</p>
                <p className="text-xl font-bold text-green-900">€{calculation.interestPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-green-600">Every {calculation.interestFrequency}</p>
                <p className="text-xs text-green-600 mt-1">{calculation.totalInterestPayments} total payments</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-sm text-blue-700">Payments start: <span className="font-semibold">{format(calculation.paymentStartDate, 'MMM dd, yyyy')}</span></p>
              <p className="text-xs text-blue-600 mt-1">After {newCredit.grace_period} month grace period</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Bank" required>
            <Select
              value={newCredit.bank_id}
              onChange={(e) => setNewCredit({ ...newCredit, bank_id: e.target.value })}
              required
            >
              <option value="">Select bank</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Credit Name" required>
            <Input
              type="text"
              value={newCredit.credit_name}
              onChange={(e) => setNewCredit({ ...newCredit, credit_name: e.target.value })}
              placeholder="e.g., Kozara Construction Loan 2024"
              required
            />
          </FormField>

          <FormField label="Company">
            <Select
              value={newCredit.company_id}
              onChange={(e) => setNewCredit({ ...newCredit, company_id: e.target.value })}
            >
              <option value="">Select company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Loan Type">
            <Select
              value={newCredit.credit_type}
              onChange={(e) => setNewCredit({ ...newCredit, credit_type: e.target.value as any })}
            >
              <option value="construction_loan_senior">Construction Loan</option>
              <option value="term_loan_senior">Term Loan</option>
              <option value="line_of_credit_senior">Line of Credit - Senior</option>
              <option value="line_of_credit_junior">Line of Credit - Junior</option>
              <option value="bridge_loan_senior">Bridge Loan</option>
            </Select>
          </FormField>

          <FormField label="Amount (€)" required>
            <Input
              type="number"
              value={newCredit.amount}
              onChange={(e) => setNewCredit({ ...newCredit, amount: parseFloat(e.target.value) || 0 })}
              required
            />
          </FormField>

          <FormField label="Interest Rate (%)">
            <Input
              type="number"
              step="0.1"
              value={newCredit.interest_rate}
              onChange={(e) => setNewCredit({ ...newCredit, interest_rate: parseFloat(e.target.value) || 0 })}
            />
          </FormField>

          <FormField label="Grace Period (months)">
            <Input
              type="number"
              value={newCredit.grace_period}
              onChange={(e) => setNewCredit({ ...newCredit, grace_period: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </FormField>

          <FormField label="Principal Repayment Type" helperText="How often to repay principal">
            <Select
              value={newCredit.principal_repayment_type}
              onChange={(e) => setNewCredit({ ...newCredit, principal_repayment_type: e.target.value as any })}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biyearly">Biyearly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </FormField>

          <FormField label="Interest Repayment Type" helperText="How often to pay interest">
            <Select
              value={newCredit.interest_repayment_type}
              onChange={(e) => setNewCredit({ ...newCredit, interest_repayment_type: e.target.value as any })}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biyearly">Biyearly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </FormField>

          <FormField label="Start Date" required>
            <DateInput
              value={newCredit.start_date}
              onChange={(value) => setNewCredit({ ...newCredit, start_date: value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </FormField>

          <FormField label="Maturity Date">
            <DateInput
              value={newCredit.maturity_date}
              onChange={(value) => setNewCredit({ ...newCredit, maturity_date: value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField label="Usage Expiration Date">
            <DateInput
              value={newCredit.usage_expiration_date || ''}
              onChange={(value) => setNewCredit({ ...newCredit, usage_expiration_date: value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FormField>

          <FormField label="Purpose" className="md:col-span-2">
            <Textarea
              value={newCredit.purpose}
              onChange={(e) => setNewCredit({ ...newCredit, purpose: e.target.value })}
              rows={3}
              placeholder="What is this credit facility for?"
            />
          </FormField>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="bg-blue-50 p-4 rounded-lg">
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
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Isplata na račun</span>
                <p className="text-sm text-gray-600 mt-1">
                  Kada je označeno, ceo iznos kredita će automatski biti isplaćen na odabrani bankovni račun firme.
                </p>
              </div>
            </label>

            {newCredit.disbursed_to_account && (
              <div className="mt-4">
                {!newCredit.company_id ? (
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
                      value={newCredit.disbursed_to_bank_account_id || ''}
                      onChange={(e) => setNewCredit({ ...newCredit, disbursed_to_bank_account_id: e.target.value })}
                      required={newCredit.disbursed_to_account}
                    >
                      <option value="">Odaberite račun</option>
                      {companyBankAccounts.map(account => (
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
        <Button variant="secondary" onClick={resetCreditForm}>
          Cancel
        </Button>
        <Button variant="success" onClick={addCredit}>
          Add Loan
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default BankCreditFormModal
