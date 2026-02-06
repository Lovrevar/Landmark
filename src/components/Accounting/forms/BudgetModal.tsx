import React from 'react'
import { X } from 'lucide-react'
import { MonthlyBudget } from '../types/calendarTypes'

interface BudgetModalProps {
  showBudgetModal: boolean
  budgetYear: number
  budgetFormData: { [key: number]: number }
  budgets: MonthlyBudget[]
  onClose: () => void
  onSave: () => void
  onYearChange: (year: number) => void
  onBudgetChange: (month: number, value: number) => void
}

const monthNames = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'
]

const BudgetModal: React.FC<BudgetModalProps> = ({
  showBudgetModal,
  budgetYear,
  budgetFormData,
  budgets,
  onClose,
  onSave,
  onYearChange,
  onBudgetChange
}) => {
  if (!showBudgetModal) return null

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value)
    onYearChange(newYear)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Namjesti Godišnji Budžet</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-800 rounded-lg p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Godina
            </label>
            <select
              value={budgetYear}
              onChange={handleYearChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthNames.map((monthName, idx) => {
              const monthNum = idx + 1
              return (
                <div key={monthNum} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {monthName}
                  </label>
                  <input
                    type="number"
                    value={budgetFormData[monthNum] || 0}
                    onChange={(e) => onBudgetChange(monthNum, parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0"
                    min="0"
                    step="1000"
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-blue-900">Ukupan godišnji budžet:</span>
              <span className="font-bold text-blue-900 text-lg">
                €{Object.values(budgetFormData).reduce((sum, val) => sum + (val || 0), 0).toLocaleString('hr-HR')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Odustani
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Spremi Budžete
          </button>
        </div>
      </div>
    </div>
  )
}

export default BudgetModal
