import React, { useState, useEffect } from 'react'
import { MilestoneFormData } from '../types/siteTypes'
import { validateMilestonePercentagesForContract } from '../services/siteService'
import { Modal, FormField, Input, Textarea, Button, Alert } from '../../ui'

interface MilestoneFormModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (data: MilestoneFormData) => void
  contractId: string
  subcontractorName: string
  projectName: string
  phaseName: string
  contractCost: number
  editingMilestone?: {
    id: string
    milestone_name: string
    description: string
    percentage: number
    due_date: string | null
  } | null
}

export const MilestoneFormModal: React.FC<MilestoneFormModalProps> = ({
  visible,
  onClose,
  onSubmit,
  contractId,
  subcontractorName,
  projectName,
  phaseName,
  contractCost,
  editingMilestone
}) => {
  const [formData, setFormData] = useState<MilestoneFormData>({
    contract_id: contractId,
    milestone_name: '',
    description: '',
    percentage: 0,
    due_date: null
  })

  const [remainingPercentage, setRemainingPercentage] = useState(100)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      if (editingMilestone) {
        setFormData({
          contract_id: contractId,
          milestone_name: editingMilestone.milestone_name,
          description: editingMilestone.description,
          percentage: editingMilestone.percentage,
          due_date: editingMilestone.due_date
        })
      } else {
        setFormData({
          contract_id: contractId,
          milestone_name: '',
          description: '',
          percentage: 0,
          due_date: null
        })
      }
      loadRemainingPercentage()
    }
  }, [visible, contractId, editingMilestone])

  const loadRemainingPercentage = async () => {
    try {
      const validation = await validateMilestonePercentagesForContract(
        contractId,
        editingMilestone?.id
      )
      setRemainingPercentage(validation.remainingPercentage)
    } catch (error) {
      console.error('Error loading remaining percentage:', error)
    }
  }

  const handleSubmit = () => {
    if (!formData.milestone_name.trim()) {
      setValidationError('Milestone name is required')
      return
    }

    if (formData.percentage <= 0) {
      setValidationError('Percentage must be greater than 0')
      return
    }

    if (formData.percentage > remainingPercentage + (editingMilestone?.percentage || 0)) {
      setValidationError(`Percentage exceeds available ${remainingPercentage + (editingMilestone?.percentage || 0)}%`)
      return
    }

    setValidationError(null)
    onSubmit(formData)
  }

  const calculateAmount = () => {
    return (contractCost * formData.percentage) / 100
  }

  if (!visible) return null

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={editingMilestone ? 'Edit Milestone' : 'Add Payment Milestone'}
        subtitle={`${projectName} • ${phaseName} • ${subcontractorName} | Contract (Base): €${contractCost.toLocaleString('hr-HR')} • Available: ${remainingPercentage.toFixed(2)}%`}
        onClose={onClose}
      />

      <Modal.Body>
        {validationError && (
          <Alert variant="error">{validationError}</Alert>
        )}

        <div className="grid grid-cols-1 gap-4 mt-4">
          <FormField label="Milestone Name" required>
            <Input
              type="text"
              value={formData.milestone_name}
              onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
              placeholder="e.g., Projektiranje, Izvedba temelja"
              required
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Describe deliverables and requirements for this milestone..."
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Percentage (%)"
              required
              helperText={`Max: ${(remainingPercentage + (editingMilestone?.percentage || 0)).toFixed(2)}%`}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                placeholder="30.00"
                required
              />
            </FormField>

            <FormField
              label="Calculated Amount"
              helperText={`${formData.percentage}% of €${contractCost.toLocaleString('hr-HR')}`}
            >
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-semibold">
                €{calculateAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </FormField>
          </div>

          <FormField label="Due Date">
            <Input
              type="date"
              value={formData.due_date || ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
            />
          </FormField>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          {editingMilestone ? 'Update Milestone' : 'Add Milestone'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
