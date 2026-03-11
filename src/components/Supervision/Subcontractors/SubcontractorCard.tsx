import React from 'react'
import { Briefcase, Pencil, Trash2 } from 'lucide-react'
import { Card } from '../../ui'
import { formatEuropean } from '../../../utils/formatters'
import { SubcontractorSummary } from './types'

interface Props {
  sub: SubcontractorSummary
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

export const SubcontractorCard: React.FC<Props> = ({ sub, onSelect, onEdit, onDelete }) => {
  const paymentPercentage = sub.total_contract_value > 0
    ? (sub.total_paid / sub.total_contract_value) * 100
    : 0

  return (
    <Card variant="default" padding="lg" onClick={onSelect}>
      <Card.Header>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{sub.name}</h3>
          <p className="text-sm text-gray-600">{sub.contact}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Subcontractor"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Subcontractor"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className={`p-2 rounded-lg ${sub.active_contracts > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Briefcase className={`w-5 h-5 ${sub.active_contracts > 0 ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>
        </div>
      </Card.Header>

      <Card.Body>
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Contracts:</span>
            <span className="font-medium text-gray-900">{sub.total_contracts}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Active / Completed:</span>
            <span className="font-medium text-gray-900">
              {sub.active_contracts} / {sub.completed_contracts}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
            <span className="text-gray-600">Total Value:</span>
            <span className="font-bold text-gray-900">€{formatEuropean(sub.total_contract_value)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Paid:</span>
            <span className="font-medium text-teal-600">€{formatEuropean(sub.total_paid)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Remaining:</span>
            <span className="font-medium text-orange-600">€{formatEuropean(sub.total_remaining)}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-600">Payment Progress</span>
            <span className="text-xs font-medium text-gray-900">{paymentPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, paymentPercentage)}%` }}
            />
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
