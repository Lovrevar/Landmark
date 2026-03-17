import React, { useState, useEffect } from 'react'
import { MilestoneFormData } from '../types'
import { validateMilestonePercentagesForContract } from '../Services/siteService'
import { Modal, FormField, Input, Textarea, Button } from '../../../ui'

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
    const errors: Record<string, string> = {}
    if (!formData.milestone_name.trim()) errors.milestone_name = 'Naziv prekretnice je obavezan'
    if (formData.percentage <= 0) errors.percentage = 'Postotak mora biti veći od 0'
    else if (formData.percentage > remainingPercentage + (editingMilestone?.percentage || 0)) {
      errors.percentage = `Postotak premašuje dostupnih ${(remainingPercentage + (editingMilestone?.percentage || 0)).toFixed(2)}%`
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
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
        <div className="grid grid-cols-1 gap-4 mt-4">
          <FormField label="Milestone Name" required error={fieldErrors.milestone_name}>
            <Input
              type="text"
              value={formData.milestone_name}
              onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
              placeholder="e.g., Projektiranje, Izvedba temelja"
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
              error={fieldErrors.percentage}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                placeholder="30.00"
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
