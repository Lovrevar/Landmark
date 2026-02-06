import React from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import DateInput from '../../Common/DateInput'
import { BankWithCredits, Company, BankCredit, NewCreditForm } from '../types/bankTypes'
import { calculatePayments } from '../services/bankService'

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
  if (!showCreditForm) return null

  const calculation = calculatePayments(newCredit)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">{editingCredit ? 'Edit Credit Facility' : 'Add New Credit Facility'}</h3>
            <button
              onClick={resetCreditForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank *</label>
              <select
                value={newCredit.bank_id}
                onChange={(e) => setNewCredit({ ...newCredit, bank_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select bank</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Credit Name *</label>
              <input
                type="text"
                value={newCredit.credit_name}
                onChange={(e) => setNewCredit({ ...newCredit, credit_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Kozara Construction Loan 2024"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <select
                value={newCredit.company_id}
                onChange={(e) => setNewCredit({ ...newCredit, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Credit Type</label>
              <select
                value={newCredit.credit_type}
                onChange={(e) => setNewCredit({ ...newCredit, credit_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="construction_loan_senior">Construction Loan</option>
                <option value="term_loan_senior">Term Loan</option>
                <option value="line_of_credit_senior">Line of Credit - Senior</option>
                <option value="line_of_credit_junior">Line of Credit - Junior</option>
                <option value="bridge_loan_senior">Bridge Loan</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (€) *</label>
              <input
                type="number"
                value={newCredit.amount}
                onChange={(e) => setNewCredit({ ...newCredit, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Interest Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={newCredit.interest_rate}
                onChange={(e) => setNewCredit({ ...newCredit, interest_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grace Period (months)</label>
              <input
                type="number"
                value={newCredit.grace_period}
                onChange={(e) => setNewCredit({ ...newCredit, grace_period: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Principal Repayment Type</label>
              <select
                value={newCredit.principal_repayment_type}
                onChange={(e) => setNewCredit({ ...newCredit, principal_repayment_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="biyearly">Biyearly</option>
                <option value="yearly">Yearly</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">How often to repay principal</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Interest Repayment Type</label>
              <select
                value={newCredit.interest_repayment_type}
                onChange={(e) => setNewCredit({ ...newCredit, interest_repayment_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="biyearly">Biyearly</option>
                <option value="yearly">Yearly</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">How often to pay interest</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
              <DateInput
                value={newCredit.start_date}
                onChange={(value) => setNewCredit({ ...newCredit, start_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Maturity Date</label>
              <DateInput
                value={newCredit.maturity_date}
                onChange={(value) => setNewCredit({ ...newCredit, maturity_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Usage Expiration Date</label>
              <DateInput
                value={newCredit.usage_expiration_date || ''}
                onChange={(value) => setNewCredit({ ...newCredit, usage_expiration_date: value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
              <textarea
                value={newCredit.purpose}
                onChange={(e) => setNewCredit({ ...newCredit, purpose: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="What is this credit facility for?"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={resetCreditForm}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={addCredit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Add Credit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BankCreditFormModal
