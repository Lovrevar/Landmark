import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ProjectWithPhases, PhaseFormInput } from '../types/siteTypes'

interface PhaseSetupModalProps {
  visible: boolean
  onClose: () => void
  project: ProjectWithPhases
  onSubmit: (phases: PhaseFormInput[]) => void
}

export const PhaseSetupModal: React.FC<PhaseSetupModalProps> = ({
  visible,
  onClose,
  project,
  onSubmit
}) => {
  const [phaseCount, setPhaseCount] = useState(4)
  const [phases, setPhases] = useState<PhaseFormInput[]>([])

  useEffect(() => {
    if (visible) {
      initializePhases()
    }
  }, [visible, phaseCount])

  const initializePhases = () => {
    const defaultPhases = [
      { phase_name: 'Foundation Phase', budget_allocated: 0, start_date: '', end_date: '' },
      { phase_name: 'Structural Phase', budget_allocated: 0, start_date: '', end_date: '' },
      { phase_name: 'Systems Installation', budget_allocated: 0, start_date: '', end_date: '' },
      { phase_name: 'Finishing Phase', budget_allocated: 0, start_date: '', end_date: '' }
    ]
    setPhases(defaultPhases.slice(0, phaseCount))
  }

  const updatePhaseCount = (count: number) => {
    setPhaseCount(count)
    const newPhases = []
    for (let i = 0; i < count; i++) {
      if (phases[i]) {
        newPhases.push(phases[i])
      } else {
        newPhases.push({
          phase_name: `Phase ${i + 1}`,
          budget_allocated: 0,
          start_date: '',
          end_date: ''
        })
      }
    }
    setPhases(newPhases)
  }

  if (!visible) return null

  const totalAllocated = phases.reduce((sum, p) => sum + p.budget_allocated, 0)
  const difference = project.budget - totalAllocated

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Setup Project Phases</h3>
              <p className="text-gray-600 mt-1">
                Distribute €{project.budget.toLocaleString()} budget across construction phases
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

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Phases
            </label>
            <select
              value={phaseCount}
              onChange={(e) => updatePhaseCount(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {[1, 2, 3, 4, 5, 6].map(count => (
                <option key={count} value={count}>{count} Phase</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {phases.map((phase, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Phase {index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phase Name</label>
                    <input
                      type="text"
                      value={phase.phase_name}
                      onChange={(e) => {
                        const newPhases = [...phases]
                        newPhases[index].phase_name = e.target.value
                        setPhases(newPhases)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Phase ${index + 1} name`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget Allocated (€)</label>
                    <input
                      type="number"
                      value={phase.budget_allocated}
                      onChange={(e) => {
                        const newPhases = [...phases]
                        newPhases[index].budget_allocated = parseFloat(e.target.value) || 0
                        setPhases(newPhases)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={phase.start_date}
                      onChange={(e) => {
                        const newPhases = [...phases]
                        newPhases[index].start_date = e.target.value
                        setPhases(newPhases)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={phase.end_date}
                      onChange={(e) => {
                        const newPhases = [...phases]
                        newPhases[index].end_date = e.target.value
                        setPhases(newPhases)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Budget Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Project Budget</p>
                <p className="text-lg font-bold text-gray-900">€{project.budget.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Allocated</p>
                <p className={`text-lg font-bold ${
                  totalAllocated === project.budget
                    ? 'text-green-600'
                    : totalAllocated > project.budget
                    ? 'text-orange-600'
                    : 'text-blue-600'
                }`}>
                  €{totalAllocated.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Difference</p>
                <p className={`text-lg font-bold ${
                  difference === 0
                    ? 'text-green-600'
                    : difference < 0
                    ? 'text-orange-600'
                    : 'text-blue-600'
                }`}>
                  {difference === 0
                    ? 'Matched'
                    : difference > 0
                    ? `€${difference.toLocaleString()} under`
                    : `€${Math.abs(difference).toLocaleString()} over`
                  }
                </p>
              </div>
            </div>
            {difference !== 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Note:</span> Phase budgets don't match the project budget. You can proceed with this allocation, but be aware of the difference when managing costs.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(phases)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Create Phases
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
