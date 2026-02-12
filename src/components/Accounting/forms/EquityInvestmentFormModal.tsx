import React, { useState, useEffect } from 'react'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../ui'
import { supabase } from '../../../lib/supabase'

interface EquityInvestmentFormModalProps {
  showEquityForm: boolean
  onClose: () => void
  investors: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string }>
  onSuccess: () => void
}

const EquityInvestmentFormModal: React.FC<EquityInvestmentFormModalProps> = ({
  showEquityForm,
  onClose,
  investors,
  projects,
  onSuccess
}) => {
  const [newInvestment, setNewInvestment] = useState({
    investor_id: '',
    project_id: '',
    investment_type: 'equity' as const,
    amount: 0,
    percentage_stake: 0,
    expected_return: 0,
    investment_date: '',
    maturity_date: '',
    payment_schedule: 'yearly' as 'monthly' | 'yearly',
    terms: '',
    mortgages_insurance: 0,
    notes: '',
    usage_expiration_date: '',
    grace_period: 0
  })

  const addInvestment = async () => {
    if (!newInvestment.investor_id || !newInvestment.amount) {
      alert('Please fill in required fields (Investor and Amount)')
      return
    }

    try {
      const { error } = await supabase
        .from('project_investments')
        .insert({
          ...newInvestment,
          project_id: newInvestment.project_id || null
        })

      if (error) throw error

      resetForm()
      onSuccess()
    } catch (error) {
      console.error('Error adding investment:', error)
      alert('Error adding investment.')
    }
  }

  const resetForm = () => {
    setNewInvestment({
      investor_id: '',
      project_id: '',
      investment_type: 'equity',
      amount: 0,
      percentage_stake: 0,
      expected_return: 0,
      investment_date: '',
      maturity_date: '',
      payment_schedule: 'yearly',
      terms: '',
      mortgages_insurance: 0,
      notes: '',
      usage_expiration_date: '',
      grace_period: 0
    })
    onClose()
  }

  return (
    <Modal show={showEquityForm} onClose={resetForm} size="lg">
      <Modal.Header title="Add New Investment" onClose={resetForm} />
      <Modal.Body>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Investor" required>
            <Select
              value={newInvestment.investor_id}
              onChange={(e) => setNewInvestment({ ...newInvestment, investor_id: e.target.value })}
            >
              <option value="">Select investor</option>
              {investors.map(investor => (
                <option key={investor.id} value={investor.id}>{investor.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Project (optional)">
            <Select
              value={newInvestment.project_id}
              onChange={(e) => setNewInvestment({ ...newInvestment, project_id: e.target.value })}
            >
              <option value="">No project (refinancing, operation costs, etc.)</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Investment Type">
            <Select
              value={newInvestment.investment_type}
              onChange={(e) => setNewInvestment({ ...newInvestment, investment_type: e.target.value as any })}
            >
              <option value="equity">Equity</option>
              <option value="loan">Loan</option>
              <option value="grant">Grant</option>
              <option value="bond">Bond</option>
              <option value="Operation Cost Loan">Operation Cost Loan</option>
              <option value="Refinancing Loan">Refinancing Loan</option>
            </Select>
          </FormField>
          <FormField label="Amount" required>
            <Input
              type="number"
              value={newInvestment.amount}
              onChange={(e) => setNewInvestment({ ...newInvestment, amount: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="Percentage Stake (%)">
            <Input
              type="number"
              step="0.1"
              value={newInvestment.percentage_stake}
              onChange={(e) => setNewInvestment({ ...newInvestment, percentage_stake: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="IRR (%)">
            <Input
              type="number"
              step="0.1"
              value={newInvestment.expected_return}
              onChange={(e) => setNewInvestment({ ...newInvestment, expected_return: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="Payment Schedule">
            <Select
              value={newInvestment.payment_schedule}
              onChange={(e) => setNewInvestment({ ...newInvestment, payment_schedule: e.target.value as 'monthly' | 'yearly' })}
            >
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </FormField>
          <FormField
            label="Yearly Cashflow"
            helperText="Annual payment amount based on IRR and investment period minus grace period"
          >
            <Input
              type="text"
              value={(() => {
                if (!newInvestment.amount || !newInvestment.investment_date || !newInvestment.maturity_date || !newInvestment.expected_return) {
                  return 'Enter amount, dates, and IRR to calculate'
                }
                const principal = newInvestment.amount
                const annualRate = newInvestment.expected_return / 100
                const gracePeriodYears = newInvestment.grace_period / 365
                const startDate = new Date(newInvestment.investment_date)
                const maturityDate = new Date(newInvestment.maturity_date)
                const totalYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                if (totalYears <= 0) return 'Invalid date range'
                const repaymentYears = Math.max(0.1, totalYears - gracePeriodYears)
                if (annualRate === 0) {
                  const payment = newInvestment.payment_schedule === 'yearly'
                    ? principal / repaymentYears
                    : principal / (repaymentYears * 12)
                  return `${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                }
                let payment
                if (newInvestment.payment_schedule === 'yearly') {
                  payment = (principal * annualRate * Math.pow(1 + annualRate, repaymentYears)) /
                           (Math.pow(1 + annualRate, repaymentYears) - 1)
                } else {
                  const monthlyRate = annualRate / 12
                  const totalMonths = repaymentYears * 12
                  payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
                           (Math.pow(1 + monthlyRate, totalMonths) - 1)
                }
                return `${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              })()}
              readOnly
              className="bg-gray-50"
            />
          </FormField>
          <FormField label="Money Multiple" helperText="Total return multiple">
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
              {(() => {
                if (!newInvestment.amount || !newInvestment.investment_date || !newInvestment.maturity_date || !newInvestment.expected_return) {
                  return 'Enter amount, dates, and IRR to calculate'
                }
                const principal = newInvestment.amount
                const annualRate = newInvestment.expected_return / 100
                const startDate = new Date(newInvestment.investment_date)
                const maturityDate = new Date(newInvestment.maturity_date)
                const years = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                if (years <= 0) return 'Invalid date range'
                const totalReturn = principal * Math.pow(1 + annualRate, years)
                const moneyMultiple = totalReturn / principal
                return `${moneyMultiple.toFixed(2)}x (${(moneyMultiple * 100).toFixed(0)}%)`
              })()}
            </div>
          </FormField>
          <FormField label="Investment Date" required>
            <Input
              type="date"
              value={newInvestment.investment_date}
              onChange={(e) => setNewInvestment({ ...newInvestment, investment_date: e.target.value })}
            />
          </FormField>
          <FormField label="Maturity Date">
            <Input
              type="date"
              value={newInvestment.maturity_date}
              onChange={(e) => setNewInvestment({ ...newInvestment, maturity_date: e.target.value })}
            />
          </FormField>
          <FormField label="Usage Expiration Date">
            <Input
              type="date"
              value={newInvestment.usage_expiration_date}
              onChange={(e) => setNewInvestment({ ...newInvestment, usage_expiration_date: e.target.value })}
            />
          </FormField>
          <FormField label="Grace Period (months)">
            <Input
              type="number"
              value={newInvestment.grace_period}
              onChange={(e) => setNewInvestment({ ...newInvestment, grace_period: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </FormField>
          <FormField label="Mortgages">
            <Input
              type="number"
              step="0.01"
              value={newInvestment.mortgages_insurance}
              onChange={(e) => setNewInvestment({ ...newInvestment, mortgages_insurance: parseFloat(e.target.value) || 0 })}
              placeholder="Amount of mortgages/insurance"
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Mortages">
              <Textarea
                value={newInvestment.terms}
                onChange={(e) => setNewInvestment({ ...newInvestment, terms: e.target.value })}
                rows={3}
                placeholder="Terms and conditions of the investment..."
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Notes">
              <Textarea
                value={newInvestment.notes}
                onChange={(e) => setNewInvestment({ ...newInvestment, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes about this investment..."
              />
            </FormField>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={resetForm}>Cancel</Button>
        <Button variant="success" onClick={addInvestment}>
          Add Investment
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default EquityInvestmentFormModal
