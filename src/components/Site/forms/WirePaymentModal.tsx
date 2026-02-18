import React, { useState, useEffect } from 'react'
import { Subcontractor, SubcontractorMilestone } from '../../../lib/supabase'
import { fetchMilestonesBySubcontractor, fetchProjectFunders } from '../services/siteService'
import { Modal, FormField, Input, Select, Textarea, Button, Alert } from '../../ui'

interface Funder {
  id: string
  name: string
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
  onSubmit: (milestoneId?: string, paidByBankId?: string | null) => void
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
  const [banks, setBanks] = useState<Funder[]>([])
  const [loadingFunders, setLoadingFunders] = useState(false)
  const [paidByBankId, setPaidByBankId] = useState<string | null>(null)

  useEffect(() => {
    if (visible && subcontractor) {
      loadMilestones()
      loadFunders()
      setPaidByBankId(subcontractor.financed_by_bank_id || null)
    } else {
      setMilestones([])
      setSelectedMilestoneId('')
      setPaidByBankId(null)
    }
  }, [visible, subcontractor])

  const loadMilestones = async () => {
    if (!subcontractor) return
    try {
      setLoading(true)
      const data = await fetchMilestonesBySubcontractor(subcontractor.id)
      setMilestones(data.filter(m => m.status === 'pending'))
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
      setBanks(funders.banks)
    } catch (error) {
      console.error('Error loading funders:', error)
    } finally {
      setLoadingFunders(false)
    }
  }

  const handleMilestoneSelect = (milestoneId: string) => {
    setSelectedMilestoneId(milestoneId)
    if (milestoneId) {
      const milestone = milestones.find(m => m.id === milestoneId)
      if (milestone && subcontractor) {
        onAmountChange((subcontractor.cost * milestone.percentage) / 100)
      }
    } else {
      onAmountChange(0)
    }
  }

  if (!visible || !subcontractor) return null

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

        {banks.length > 0 && (
          <FormField
            label="Paid By (Optional)"
            helperText={
              subcontractor.financed_by_bank_id ? (
                <span className="text-blue-600">
                  Default: {banks.find(b => b.id === subcontractor.financed_by_bank_id)?.name || 'Bank'} (can be changed)
                </span>
              ) : (
                'Select which bank is making this payment'
              )
            }
          >
            <Select
              value={paidByBankId || ''}
              onChange={(e) => setPaidByBankId(e.target.value || null)}
              disabled={loadingFunders}
            >
              <option value="">No payer selected</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
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
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="success" onClick={() => onSubmit(selectedMilestoneId || undefined, paidByBankId)} disabled={amount <= 0}>
          Record Payment
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
