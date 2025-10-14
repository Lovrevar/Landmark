import React from 'react'
import { X } from 'lucide-react'
import { Subcontractor } from '../../../lib/supabase'

interface EditSubcontractorModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: Subcontractor | null
  onChange: (updated: Subcontractor) => void
  onSubmit: () => void
}

export const EditSubcontractorModal: React.FC<EditSubcontractorModalProps> = ({
  visible,
  onClose,
  subcontractor,
  onChange,
  onSubmit
}) => {
  if (!visible || !subcontractor) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Edit Subcontractor</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={subcontractor.name}
              onChange={(e) => onChange({ ...subcontractor, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact *</label>
            <input
              type="text"
              value={subcontractor.contact}
              onChange={(e) => onChange({ ...subcontractor, contact: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Phone or email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Job Description *</label>
            <textarea
              value={subcontractor.job_description}
              onChange={(e) => onChange({ ...subcontractor, job_description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contract Cost (€) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={subcontractor.cost}
                onChange={(e) => onChange({ ...subcontractor, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deadline *</label>
              <input
                type="date"
                value={subcontractor.deadline}
                onChange={(e) => onChange({ ...subcontractor, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Progress: {subcontractor.progress || 0}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={subcontractor.progress || 0}
              onChange={(e) => onChange({ ...subcontractor, progress: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Not Started</span>
              <span>In Progress</span>
              <span>Completed</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Progress indicates work completion status, independent of payment
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700"><strong>Payment Info (Read-only)</strong></p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-medium text-gray-900">€{subcontractor.budget_realized.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining:</span>
                <span className="font-medium text-orange-600">
                  €{Math.max(0, subcontractor.cost - subcontractor.budget_realized).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
