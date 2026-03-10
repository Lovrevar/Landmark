import React from 'react'
import { Eye } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { Card, Badge } from '../../ui'
import { formatEuro } from '../../../utils/formatters'
import { SubcontractorContract } from '../types'

interface Props {
  contracts: SubcontractorContract[]
  onViewDocuments: (contract: SubcontractorContract) => void
}

export const SubcontractorContractsList: React.FC<Props> = ({ contracts, onViewDocuments }) => {
  return (
    <div className="space-y-4">
      {contracts.map((contract) => {
        const isOverdue = contract.deadline
          ? new Date(contract.deadline) < new Date() && contract.progress < 100
          : false
        const daysUntilDeadline = contract.deadline
          ? differenceInDays(new Date(contract.deadline), new Date())
          : 0
        const hasValidContract = contract.has_contract && contract.cost > 0

        return (
          <Card key={contract.id} variant="bordered" padding="md">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">{contract.project_name}</h4>
                  {!hasValidContract && (
                    <Badge variant="yellow" size="sm">BEZ UGOVORA</Badge>
                  )}
                </div>
                {contract.phase_name && (
                  <p className="text-sm text-gray-600">{contract.phase_name}</p>
                )}
                <p className="text-sm text-gray-600 mt-1">{contract.job_description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {hasValidContract && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewDocuments(contract) }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Prikaži dokumente ugovora"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                {hasValidContract && (
                  <Badge
                    variant={
                      contract.progress >= 100 ? 'green' :
                      contract.progress > 0 ? 'blue' : 'gray'
                    }
                  >
                    {contract.progress}% Complete
                  </Badge>
                )}
              </div>
            </div>

            {hasValidContract ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-600">Contract:</p>
                  <p className="font-medium text-gray-900">{formatEuro(contract.cost)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Paid:</p>
                  <p className="font-medium text-teal-600">{formatEuro(contract.budget_realized)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Remaining:</p>
                  <p className="font-medium text-orange-600">{formatEuro(contract.cost - contract.budget_realized)}</p>
                </div>
                {contract.deadline && (
                  <div>
                    <p className="text-gray-600">Deadline:</p>
                    <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      {format(new Date(contract.deadline), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-600">Value:</p>
                  <p className="font-medium text-gray-900">{formatEuro(contract.invoice_value)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Paid:</p>
                  <p className="font-medium text-teal-600">{formatEuro(contract.budget_realized)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Remaining:</p>
                  <p className="font-medium text-orange-600">{formatEuro(contract.invoice_value - contract.budget_realized)}</p>
                </div>
                {contract.deadline && (
                  <div>
                    <p className="text-gray-600">Deadline:</p>
                    <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      {format(new Date(contract.deadline), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {isOverdue && (
              <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                ⚠️ Overdue by {Math.abs(daysUntilDeadline)} days
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
