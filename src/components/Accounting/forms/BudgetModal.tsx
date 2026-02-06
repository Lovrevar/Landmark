import React from 'react'
import { MonthlyBudget } from '../types/calendarTypes'
import { Modal, Button, Select, Input, FormField } from '../../ui'

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
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value)
    onYearChange(newYear)
  }

  return (
    <Modal show={showBudgetModal} onClose={onClose} size="xl">
      <Modal.Header
        title="Namjesti Godišnji Budžet"
        onClose={onClose}
      />

      <Modal.Body>
        <FormField label="Godina">
          <Select
            value={budgetYear}
            onChange={handleYearChange}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthNames.map((monthName, idx) => {
            const monthNum = idx + 1
            return (
              <div key={monthNum} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <FormField label={monthName}>
                  <Input
                    type="number"
                    value={budgetFormData[monthNum] || 0}
                    onChange={(e) => onBudgetChange(monthNum, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    step="1000"
                  />
                </FormField>
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
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Odustani
        </Button>
        <Button variant="success" onClick={onSave}>
          Spremi Budžete
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default BudgetModal
