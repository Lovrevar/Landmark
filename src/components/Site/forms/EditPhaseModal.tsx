import React, { useState, useEffect } from 'react'
import { ProjectPhase } from '../../../lib/supabase'
import { ProjectWithPhases, EditPhaseFormData } from '../types/siteTypes'
import { Modal, FormField, Input, Select, Button } from '../../ui'

interface EditPhaseModalProps {
  visible: boolean
  onClose: () => void
  phase: ProjectPhase | null
  project: ProjectWithPhases
  onSubmit: (updates: EditPhaseFormData) => void
}

export const EditPhaseModal: React.FC<EditPhaseModalProps> = ({
  visible,
  onClose,
  phase,
  project,
  onSubmit
}) => {
  const [formData, setFormData] = useState<EditPhaseFormData>({
    phase_name: '',
    budget_allocated: 0,
    start_date: '',
    end_date: '',
    status: 'planning'
  })

  useEffect(() => {
    if (phase) {
      setFormData({
        phase_name: phase.phase_name,
        budget_allocated: phase.budget_allocated,
        start_date: phase.start_date || '',
        end_date: phase.end_date || '',
        status: phase.status
      })
    }
  }, [phase])

  if (!visible || !phase) return null

  const otherPhasesTotalBudget = project.phases
    .filter(p => p.id !== phase.id)
    .reduce((sum, p) => sum + p.budget_allocated, 0)
  const newTotalAllocated = otherPhasesTotalBudget + formData.budget_allocated
  const projectBudgetDiff = newTotalAllocated - project.budget

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title="Edit Phase"
        subtitle={`Phase ${phase.phase_number} • Budget Used: €${phase.budget_used.toLocaleString('hr-HR')}`}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="space-y-4">
          <FormField label="Phase Name" required>
            <Input
              type="text"
              value={formData.phase_name}
              onChange={(e) => setFormData({ ...formData, phase_name: e.target.value })}
              placeholder="Enter phase name"
              required
            />
          </FormField>

          <FormField
            label="Budget Allocated (€)"
            required
            helperText={
              formData.budget_allocated < phase.budget_used
                ? `Warning: Budget is less than already allocated amount (€${phase.budget_used.toLocaleString('hr-HR')})`
                : `Available after update: €${(formData.budget_allocated - phase.budget_used).toLocaleString('hr-HR')}`
            }
            error={formData.budget_allocated < phase.budget_used}
          >
            <Input
              type="number"
              value={formData.budget_allocated}
              onChange={(e) => setFormData({ ...formData, budget_allocated: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Start Date">
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>
            <FormField label="End Date">
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Status">
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </Select>
          </FormField>

          {projectBudgetDiff !== 0 && (
            <div className={`p-4 rounded-lg border ${
              projectBudgetDiff > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-sm ${projectBudgetDiff > 0 ? 'text-orange-800' : 'text-blue-800'}`}>
                <span className="font-medium">Note:</span> After this update, total phase budgets
                ({' €' + newTotalAllocated.toLocaleString('hr-HR')}) will be {' '}
                {projectBudgetDiff > 0
                  ? `€${Math.abs(projectBudgetDiff).toLocaleString('hr-HR')} over`
                  : `€${Math.abs(projectBudgetDiff).toLocaleString('hr-HR')} under`
                } the project budget.
              </p>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(formData)}>
          Update Phase
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
