import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ProjectPhase } from '../../../lib/supabase'
import { ProjectWithPhases, EditPhaseFormData } from '../types/siteTypes'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Edit Phase</h3>
              <p className="text-gray-600 mt-1">
                Phase {phase.phase_number} • Budget Used: €{phase.budget_used.toLocaleString()}
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phase Name *</label>
              <input
                type="text"
                value={formData.phase_name}
                onChange={(e) => setFormData({ ...formData, phase_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter phase name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget Allocated (€) *</label>
              <input
                type="number"
                value={formData.budget_allocated}
                onChange={(e) => setFormData({ ...formData, budget_allocated: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
              />
              {formData.budget_allocated < phase.budget_used && (
                <p className="text-xs text-red-600 mt-1">
                  Warning: Budget is less than already allocated amount (€{phase.budget_used.toLocaleString()})
                </p>
              )}
              {formData.budget_allocated >= phase.budget_used && (
                <p className="text-xs text-gray-500 mt-1">
                  Available after update: €{(formData.budget_allocated - phase.budget_used).toLocaleString()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            {projectBudgetDiff !== 0 && (
              <div className={`p-4 rounded-lg border ${
                projectBudgetDiff > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <p className={`text-sm ${projectBudgetDiff > 0 ? 'text-orange-800' : 'text-blue-800'}`}>
                  <span className="font-medium">Note:</span> After this update, total phase budgets
                  ({' €' + newTotalAllocated.toLocaleString()}) will be {' '}
                  {projectBudgetDiff > 0
                    ? `€${Math.abs(projectBudgetDiff).toLocaleString()} over`
                    : `€${Math.abs(projectBudgetDiff).toLocaleString()} under`
                  } the project budget.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(formData)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Update Phase
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
