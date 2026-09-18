import React from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, DollarSign, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases } from './types'
import { Button, Badge } from '../../ui'
import { isFullySettled } from './utils/contractTree'
import { contractVariance } from '../../../utils/contractVariance'
import { formatEuro } from '../../../utils/formatters'

interface ContractCardProps {
  subcontractor: Subcontractor
  phase: ProjectPhase
  project: ProjectWithPhases
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
}

/**
 * One contract, rendered as a card. Lifted out of PhaseCard when the tree gained a third nesting
 * level.
 */
export const ContractCard: React.FC<ContractCardProps> = ({
  subcontractor,
  phase,
  project,
  onOpenPaymentHistory,
  onOpenInvoices,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor,
  onManageMilestones
}) => {
  const { t } = useTranslation()

  const hasValidContract = subcontractor.has_contract !== false && subcontractor.cost > 0
  // One definition of paid across the app: contracts.budget_realized (see 20260910120000).
  const actualPaid = subcontractor.budget_realized || 0
  const isOverdue = subcontractor.deadline ? new Date(subcontractor.deadline) < new Date() && actualPaid < subcontractor.cost : false

  // Site Management lists only draft and active contracts, so "settled" here can only mean paid
  // in full, and a saving never shows: the variance row appears only for an overrun.
  const variance = hasValidContract
    ? contractVariance({ contracted: subcontractor.cost, paid: actualPaid, settled: isFullySettled(subcontractor) })
    : { kind: 'none' as const }
  const isOverrun = variance.kind === 'overrun'
  const isPaid = hasValidContract && actualPaid >= subcontractor.cost
  const remainingToPay = hasValidContract ? Math.max(0, subcontractor.cost - actualPaid) : 0

  return (
    <div key={subcontractor.id} className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
      !hasValidContract ? 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20' :
      isOverrun ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
      isPaid ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
      actualPaid > 0 ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30' :
      'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">{subcontractor.name}</h4>
            {subcontractor.has_contract === false && (
              <Badge variant="yellow" size="sm">
                {t('supervision.subcontractor_details.no_contract_badge')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{subcontractor.contact}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{subcontractor.job_description}</p>
        </div>
        {hasValidContract && (
          <Badge variant={
            isOverrun ? 'red' :
            isPaid ? 'green' :
            actualPaid > 0 ? 'blue' :
            'gray'
          } size="sm">
            {isOverrun ? t('status.over_budget') :
             isPaid ? t('status.paid') :
             actualPaid > 0 ? t('status.partial') : t('status.unpaid')}
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-xs mb-3">
        {subcontractor.deadline && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('supervision.contract_fields.deadline')}:</span>
            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
              {format(new Date(subcontractor.deadline), 'MMM dd, yyyy')}
            </span>
          </div>
        )}
        {hasValidContract ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('common.contract')}:</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatEuro(subcontractor.cost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('common.paid')}:</span>
              <span className="font-medium text-teal-600 dark:text-teal-400">{formatEuro(actualPaid)}</span>
            </div>
            {remainingToPay > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('common.remaining')}:</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">{formatEuro(remainingToPay)}</span>
              </div>
            )}
            {variance.kind !== 'none' && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  {variance.kind === 'overrun' ? t('common.contract_overrun') : t('common.contract_saving')}:
                </span>
                <span className={`font-bold ${variance.kind === 'overrun' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatEuro(variance.amount)}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400 font-medium">{t('supervision.subcontractor_details.total_paid')}:</span>
              <span className="font-bold text-green-600 dark:text-green-400">{formatEuro(actualPaid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 font-medium">{t('supervision.site_management.phase_card.total_owed')}:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{formatEuro(subcontractor.invoice_total_owed || 0)}</span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        {onOpenPaymentHistory && (
          <Button
            variant="primary"
            size="sm"
            icon={DollarSign}
            fullWidth
            onClick={() => onOpenPaymentHistory(subcontractor)}
          >
            {t('common.payments')}
          </Button>
        )}
        {onOpenInvoices && (
          <Button
            variant="primary"
            size="sm"
            icon={FileText}
            fullWidth
            onClick={() => onOpenInvoices(subcontractor)}
          >
            {t('common.invoices')}
          </Button>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => onEditSubcontractor(subcontractor)}
          >
            {t('common.edit')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => onOpenSubDetails(subcontractor)}
          >
            {t('common.details')}
          </Button>
          {onManageMilestones && (
            <Button
              variant="amber"
              size="sm"
              icon={Calendar}
              fullWidth
              onClick={() => onManageMilestones(subcontractor, phase, project)}
            />
          )}
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            fullWidth
            onClick={() => onDeleteSubcontractor(subcontractor.id)}
          >
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  )
}
