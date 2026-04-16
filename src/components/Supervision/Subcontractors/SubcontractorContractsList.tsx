import React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { Card, Badge } from '../../ui'
import { formatEuro } from '../../../utils/formatters'
import { SubcontractorContract } from './types'

interface Props {
  contracts: SubcontractorContract[]
  onViewDocuments: (contract: SubcontractorContract) => void
}

export const SubcontractorContractsList: React.FC<Props> = ({ contracts, onViewDocuments }) => {
  const { t } = useTranslation()

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
                  <h4 className="font-semibold text-gray-900 dark:text-white">{contract.project_name}</h4>
                  {!hasValidContract && (
                    <Badge variant="yellow" size="sm">{t('supervision.subcontractor_details.no_contract_badge')}</Badge>
                  )}
                </div>
                {contract.phase_name && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{contract.phase_name}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{contract.job_description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {hasValidContract && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewDocuments(contract) }}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                    title={t('supervision.subcontractors.view_contract_docs')}
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
                    {contract.progress}% {t('supervision.subcontractors.complete')}
                  </Badge>
                )}
              </div>
            </div>

            {hasValidContract ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">{t('common.contract')}:</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatEuro(contract.cost)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">{t('common.paid')}:</p>
                  <p className="font-medium text-teal-600">{formatEuro(contract.budget_realized)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">{t('common.remaining')}:</p>
                  <p className="font-medium text-orange-600">{formatEuro(contract.cost - contract.budget_realized)}</p>
                </div>
                {contract.deadline && (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('supervision.contract_fields.deadline')}:</p>
                    <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                      {format(new Date(contract.deadline), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">{t('supervision.subcontractors.value')}:</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatEuro(contract.invoice_value)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">{t('common.paid')}:</p>
                  <p className="font-medium text-teal-600">{formatEuro(contract.budget_realized)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">{t('common.remaining')}:</p>
                  <p className="font-medium text-orange-600">{formatEuro(contract.invoice_value - contract.budget_realized)}</p>
                </div>
                {contract.deadline && (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('supervision.contract_fields.deadline')}:</p>
                    <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                      {format(new Date(contract.deadline), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {isOverdue && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
                ⚠️ {t('supervision.subcontractors.overdue_by', { days: Math.abs(daysUntilDeadline) })}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
