import React, { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { MilestoneFormData } from '../types/siteTypes'
import { validateMilestonePercentagesForPhase } from '../services/siteService'

interface MilestoneFormModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (data: MilestoneFormData) => void
  subcontractorId: string
  projectId: string
  phaseId: string
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
  subcontractorId,
  projectId,
  phaseId,
  subcontractorName,
  projectName,
  phaseName,
  contractCost,
  editingMilestone
}) => {
  const [formData, setFormData] = useState<MilestoneFormData>({
    subcontractor_id: subcontractorId,
    project_id: projectId,
    phase_id: phaseId,
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
          subcontractor_id: subcontractorId,
          project_id: projectId,
          phase_id: phaseId,
          milestone_name: editingMilestone.milestone_name,
          description: editingMilestone.description,
          percentage: editingMilestone.percentage,
          due_date: editingMilestone.due_date
        })
      } else {
        setFormData({
          subcontractor_id: subcontractorId,
          project_id: projectId,
          phase_id: phaseId,
          milestone_name: '',
          description: '',
          percentage: 0,
          due_date: null
        })
      }
      loadRemainingPercentage()
    }
  }, [visible, subcontractorId, projectId, phaseId, editingMilestone])

  const loadRemainingPercentage = async () => {
    try {
      const validation = await validateMilestonePercentagesForPhase(
        subcontractorId,
        phaseId,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {editingMilestone ? 'Edit Milestone' : 'Add Payment Milestone'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {projectName} • {phaseName} • {subcontractorName}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Contract: €{contractCost.toLocaleString()} • Available: {remainingPercentage.toFixed(2)}%
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {validationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800">{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Milestone Name *
              </label>
              <input
                type="text"
                value={formData.milestone_name}
                onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Projektiranje, Izvedba temelja"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe deliverables and requirements for this milestone..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Percentage (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.percentage}
                  onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="30.00"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max: {(remainingPercentage + (editingMilestone?.percentage || 0)).toFixed(2)}%
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Calculated Amount
                </label>
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-semibold">
                  €{calculateAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.percentage}% of €{contractCost.toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              {editingMilestone ? 'Update Milestone' : 'Add Milestone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
