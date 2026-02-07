import React, { useState, useEffect } from 'react'
import { Building2, User } from 'lucide-react'
import { Subcontractor, SubcontractorMilestone } from '../../../lib/supabase'
import { fetchMilestonesBySubcontractor, fetchProjectFunders } from '../services/siteService'
import { Modal, FormField, Input, Select, Textarea, Button, Alert } from '../../ui'

interface Funder {
  id: string
  name: string
  type?: string
}

interface WirePaymentModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: Subcontractor | null
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onNotesChange: (notes: string) => void
  onSubmit: (milestoneId?: string, paidByType?: 'investor' | 'bank' | null, paidByInvestorId?: string | null, paidByBankId?: string | null) => void
  projectId: string
}

export const WirePaymentModal: React.FC<WirePaymentModalProps> = ({
  visible,
  onClose,
  subcontractor,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit,
  projectId
}) => {
  const [milestones, setMilestones] = useState<SubcontractorMilestone[]>([])
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [investors, setInvestors] = useState<Funder[]>([])
  const [banks, setBanks] = useState<Funder[]>([])
  const [loadingFunders, setLoadingFunders] = useState(false)
  const [paidByType, setPaidByType] = useState<'investor' | 'bank' | null>(null)
  const [paidByInvestorId, setPaidByInvestorId] = useState<string | null>(null)
  const [paidByBankId, setPaidByBankId] = useState<string | null>(null)

  useEffect(() => {
    if (visible && subcontractor) {
      loadMilestones()
      loadFunders()

      if (subcontractor.financed_by_type && (subcontractor.financed_by_investor_id || subcontractor.financed_by_bank_id)) {
        setPaidByType(subcontractor.financed_by_type)
        if (subcontractor.financed_by_type === 'investor') {
          setPaidByInvestorId(subcontractor.financed_by_investor_id || null)
          setPaidByBankId(null)
        } else {
          setPaidByBankId(subcontractor.financed_by_bank_id || null)
          setPaidByInvestorId(null)
        }
      }
    } else {
      setMilestones([])
      setSelectedMilestoneId('')
      setPaidByType(null)
      setPaidByInvestorId(null)
      setPaidByBankId(null)
    }
  }, [visible, subcontractor])

  const loadMilestones = async () => {
    if (!subcontractor) return

    try {
      setLoading(true)
      const data = await fetchMilestonesBySubcontractor(subcontractor.id)
      const pendingMilestones = data.filter(m => m.status === 'pending')
      setMilestones(pendingMilestones)
    } catch (error) {
      console.error('Error loading milestones:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFunders = async () => {
    if (!projectId) return

    try {
      setLoadingFunders(true)
      const funders = await fetchProjectFunders(projectId)
      setInvestors(funders.investors)
      setBanks(funders.banks)
    } catch (error) {
      console.error('Error loading funders:', error)
    } finally {
      setLoadingFunders(false)
    }
  }

  const handlePaidByChange = (value: string) => {
    if (!value) {
      setPaidByType(null)
      setPaidByInvestorId(null)
      setPaidByBankId(null)
      return
    }

    const [type, id] = value.split(':')
    if (type === 'investor') {
      setPaidByType('investor')
      setPaidByInvestorId(id)
      setPaidByBankId(null)
    } else if (type === 'bank') {
      setPaidByType('bank')
      setPaidByBankId(id)
      setPaidByInvestorId(null)
    }
  }

  const getPaidByValue = () => {
    if (paidByType === 'investor' && paidByInvestorId) {
      return `investor:${paidByInvestorId}`
    }
    if (paidByType === 'bank' && paidByBankId) {
      return `bank:${paidByBankId}`
    }
    return ''
  }

  const handleMilestoneSelect = (milestoneId: string) => {
    setSelectedMilestoneId(milestoneId)

    if (milestoneId) {
      const milestone = milestones.find(m => m.id === milestoneId)
      if (milestone && subcontractor) {
        const milestoneAmount = (subcontractor.cost * milestone.percentage) / 100
        onAmountChange(milestoneAmount)
      }
    } else {
      onAmountChange(0)
    }
  }

  if (!visible || !subcontractor) return null

  const handleSubmit = () => {
    console.log('WirePaymentModal: Record Payment button clicked', {
      amount,
      paymentDate,
      notes,
      subcontractor: subcontractor.name,
      milestoneId: selectedMilestoneId || undefined,
      paidByType,
      paidByInvestorId,
      paidByBankId
    })
    onSubmit(selectedMilestoneId || undefined, paidByType, paidByInvestorId, paidByBankId)
  }

  const newTotalPaid = subcontractor.budget_realized + amount
  const wouldBeOverBudget = newTotalPaid > subcontractor.cost

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title="Make Wire Payment"
        subtitle={subcontractor.name}
        onClose={onClose}
      />

      <Modal.Body>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Contract Amount:</span>
              <span className="text-sm font-medium text-gray-900">€{subcontractor.cost.toLocaleString('hr-HR')}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Already Paid:</span>
              <span className="text-sm font-medium text-teal-600">€{subcontractor.budget_realized.toLocaleString('hr-HR')}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Remaining:</span>
              <span className="text-sm font-bold text-orange-600">
                €{Math.max(0, subcontractor.cost - subcontractor.budget_realized).toLocaleString('hr-HR')}
              </span>
            </div>
          </div>

          {milestones.length > 0 && (
            <FormField
              label="Select Milestone (Optional)"
              helperText="Selecting a milestone will auto-fill the payment amount"
            >
              <Select
                value={selectedMilestoneId}
                onChange={(e) => handleMilestoneSelect(e.target.value)}
              >
                <option value="">Manual Payment (No Milestone)</option>
                {milestones.map((milestone) => {
                  const milestoneAmount = (subcontractor.cost * milestone.percentage) / 100
                  return (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.milestone_number}. {milestone.milestone_name} - {milestone.percentage}% (€{milestoneAmount.toLocaleString('hr-HR')})
                    </option>
                  )
                })}
              </Select>
            </FormField>
          )}

          <FormField
            label="Payment Amount (€)"
            required
            helperText="You can pay any amount, including more than the contract value"
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              placeholder="Enter payment amount"
              autoFocus
            />
          </FormField>

          <FormField
            label="Payment Date (Optional)"
            helperText="Leave empty if date is not yet known"
          >
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </FormField>

          {(investors.length > 0 || banks.length > 0) && (
            <FormField
              label="Paid By (Optional)"
              helperText={
                subcontractor.financed_by_type && (subcontractor.financed_by_investor_id || subcontractor.financed_by_bank_id) ? (
                  <span className="text-blue-600">
                    Default: {subcontractor.financed_by_type === 'investor'
                      ? investors.find(i => i.id === subcontractor.financed_by_investor_id)?.name || 'Investor'
                      : banks.find(b => b.id === subcontractor.financed_by_bank_id)?.name || 'Bank'
                    } (can be changed)
                  </span>
                ) : (
                  'Select which investor or bank is making this payment'
                )
              }
            >
              <Select
                value={getPaidByValue()}
                onChange={(e) => handlePaidByChange(e.target.value)}
                disabled={loadingFunders}
              >
                <option value="">No payer selected</option>
                {investors.length > 0 && (
                  <optgroup label="Investors">
                    {investors.map(investor => (
                      <option key={investor.id} value={`investor:${investor.id}`}>
                        {investor.name} {investor.type && `(${investor.type})`}
                      </option>
                    ))}
                  </optgroup>
                )}
                {banks.length > 0 && (
                  <optgroup label="Banks">
                    {banks.map(bank => (
                      <option key={bank.id} value={`bank:${bank.id}`}>
                        {bank.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </FormField>
          )}

          <FormField label="Notes (Optional)">
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={2}
              placeholder="Add any notes about this payment"
            />
          </FormField>

          {amount > 0 && wouldBeOverBudget && (
            <Alert variant="warning">
              <p className="text-sm">
                <span className="font-medium">New Total Paid:</span> €{newTotalPaid.toLocaleString('hr-HR')}
              </p>
              <p className="text-sm mt-1">
                <span className="font-medium">Loss:</span> €{(newTotalPaid - subcontractor.cost).toLocaleString('hr-HR')}
              </p>
            </Alert>
          )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSubmit} disabled={amount <= 0}>
          Record Payment
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
