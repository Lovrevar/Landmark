import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2, DollarSign, Users, Calendar, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases } from './types'
import { Button, Badge, EmptyState } from '../../ui'

interface PhaseCardProps {
  phase: ProjectPhase
  project: ProjectWithPhases
  phaseSubcontractors: Subcontractor[]
  onEditPhase: (phase: ProjectPhase) => void
  onDeletePhase: (phase: ProjectPhase) => void
  onAddSubcontractor: (phase: ProjectPhase) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
  isExpanded: boolean
  expandedContractTypes: Set<string>
  onToggleExpand: () => void
  onToggleContractType: (typeKey: string) => void
}

export const PhaseCard: React.FC<PhaseCardProps> = ({
  phase,
  project,
  phaseSubcontractors,
  onEditPhase,
  onDeletePhase,
  onAddSubcontractor,
  onOpenPaymentHistory,
  onOpenInvoices,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor,
  onManageMilestones,
  isExpanded,
  expandedContractTypes,
  onToggleExpand,
  onToggleContractType
}) => {
  const { t } = useTranslation()

  const groupedSubcontractors = phaseSubcontractors.reduce((groups, sub) => {
    const typeKey = sub.contract_type_name || t('supervision.site_management.phase_card.uncategorized')
    if (!groups[typeKey]) {
      groups[typeKey] = []
    }
    groups[typeKey].push(sub)
    return groups
  }, {} as Record<string, typeof phaseSubcontractors>)

  const uncategorizedKey = t('supervision.site_management.phase_card.uncategorized')
  const sortedContractTypeKeys = Object.keys(groupedSubcontractors).sort((a, b) => {
    if (a === uncategorizedKey) return 1
    if (b === uncategorizedKey) return -1
    return a.localeCompare(b)
  })

  const subcontractorsWithContract = phaseSubcontractors.filter(sub => sub.has_contract !== false && (sub.cost ?? 0) > 0)
  const subcontractorsWithoutContract = phaseSubcontractors.filter(sub => sub.has_contract === false || (sub.cost ?? 0) === 0)

  const totalContractCost = subcontractorsWithContract.reduce((sum, sub) => sum + (sub.cost ?? 0), 0)

  const totalPaidWithContract = subcontractorsWithContract.reduce((sum, sub) => sum + (sub.invoice_total_paid || 0), 0)
  const totalPaidWithoutContract = subcontractorsWithoutContract.reduce((sum, sub) => sum + (sub.invoice_total_paid || 0), 0)
  const totalPaidOut = totalPaidWithContract + totalPaidWithoutContract

  const totalUnpaidWithContract = subcontractorsWithContract.reduce((sum, sub) => {
    const paid = sub.invoice_total_paid || 0
    return sum + Math.max(0, (sub.cost ?? 0) - paid)
  }, 0)
  const totalUnpaidWithoutContract = subcontractorsWithoutContract.reduce((sum, sub) => sum + (sub.invoice_total_owed || 0), 0)
  const totalUnpaid = totalUnpaidWithContract + totalUnpaidWithoutContract

  const budgetUtilization = phase.budget_allocated > 0 ? (totalPaidOut / phase.budget_allocated) * 100 : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="primary"
              size="icon-lg"
              icon={isExpanded ? ChevronUp : ChevronDown}
              onClick={onToggleExpand}
            />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{phase.phase_name}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.phase_card.phase_label')} {phase.phase_number} • {phaseSubcontractors.length} {phaseSubcontractors.length !== 1 ? t('common.subcontractors') : t('common.subcontractor')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900 dark:text-white">€{phase.budget_allocated.toLocaleString('hr-HR')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('supervision.site_management.phase_card.forecasted_budget')}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-md"
              icon={Edit2}
              onClick={() => onEditPhase(phase)}
            />
            <Button
              variant="outline-danger"
              size="icon-md"
              icon={Trash2}
              onClick={() => onDeletePhase(phase)}
            />
            <Button
              variant="success"
              icon={Plus}
              onClick={() => onAddSubcontractor(phase)}
            >
              {t('supervision.subcontractors.add')}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-200">{t('supervision.site_management.phase_card.contracted_amount')}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">€{totalContractCost.toLocaleString('hr-HR')}</p>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg">
            <p className="text-sm text-teal-700 dark:text-teal-400">{t('supervision.site_management.phase_card.paid_out')}</p>
            <p className="text-lg font-bold text-teal-900 dark:text-teal-300">€{totalPaidOut.toLocaleString('hr-HR')}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
            <p className="text-sm text-orange-700 dark:text-orange-400">{t('supervision.site_management.phase_card.unpaid_contracts')}</p>
            <p className="text-lg font-bold text-orange-900 dark:text-orange-300">
              €{totalUnpaid.toLocaleString('hr-HR')}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            (phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract) < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <p className={`text-sm ${
              (phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract) < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
            }`}>Budget</p>
            <p className={`text-lg font-bold ${
              (phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract) < 0 ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'
            }`}>
              €{(phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract).toLocaleString('hr-HR')}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('supervision.site_management.phase_card.budget_utilization')}</span>
            <span className="text-sm font-medium">{budgetUtilization.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                budgetUtilization > 100 ? 'bg-red-600' :
                budgetUtilization > 80 ? 'bg-orange-600' :
                'bg-teal-600'
              }`}
              style={{ width: `${Math.min(100, budgetUtilization)}%` }}
            ></div>
          </div>
          {budgetUtilization > 100 && (
            <p className="text-xs text-red-600 mt-1">
              {t('supervision.site_management.phase_card.over_budget_by')} €{(totalPaidOut - phase.budget_allocated).toLocaleString('hr-HR')}
            </p>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {phaseSubcontractors.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('supervision.site_management.phase_card.no_subs_title')}
            description={t('supervision.site_management.phase_card.no_subs_desc')}
          />
        ) : (
          <div className="space-y-4">
            {sortedContractTypeKeys.map((contractTypeName) => {
              const subcontractors = groupedSubcontractors[contractTypeName]
              const isTypeExpanded = expandedContractTypes.has(contractTypeName)
              const totalCost = subcontractors.reduce((sum, sub) => sum + (sub.cost || 0), 0)
              const totalPaid = subcontractors.reduce((sum, sub) => sum + (sub.invoice_total_paid || 0), 0)

              return (
                <div key={contractTypeName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => onToggleContractType(contractTypeName)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      {isTypeExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-white">{contractTypeName}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">({subcontractors.length})</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.phase_card.cost')}: </span>
                        <span className="font-semibold text-gray-900 dark:text-white">€{totalCost.toLocaleString('hr-HR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">{t('common.paid')}: </span>
                        <span className="font-semibold text-teal-600">€{totalPaid.toLocaleString('hr-HR')}</span>
                      </div>
                    </div>
                  </button>

                  {isTypeExpanded && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subcontractors.map((subcontractor) => {
              const hasValidContract = subcontractor.has_contract !== false && subcontractor.cost > 0
              const actualPaid = subcontractor.invoice_total_paid || 0
              const isOverdue = subcontractor.deadline ? new Date(subcontractor.deadline) < new Date() && actualPaid < subcontractor.cost : false

              const subVariance = hasValidContract ? actualPaid - subcontractor.cost : 0
              const isPaid = hasValidContract && actualPaid >= subcontractor.cost
              const remainingToPay = hasValidContract ? Math.max(0, subcontractor.cost - actualPaid) : 0

              return (
                <div key={subcontractor.id} className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                  !hasValidContract ? 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20' :
                  subVariance > 0 ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                  isPaid && subVariance === 0 ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
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
                        subVariance > 0 ? 'red' :
                        isPaid && subVariance === 0 ? 'green' :
                        actualPaid > 0 ? 'blue' :
                        'gray'
                      } size="sm">
                        {subVariance > 0 ? t('status.over_budget') :
                         isPaid && subVariance === 0 ? t('status.paid') :
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
                          <span className="font-medium text-gray-900 dark:text-white">€{subcontractor.cost.toLocaleString('hr-HR')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{t('common.paid')}:</span>
                          <span className="font-medium text-teal-600">€{actualPaid.toLocaleString('hr-HR')}</span>
                        </div>
                        {remainingToPay > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{t('common.remaining')}:</span>
                            <span className="font-medium text-orange-600">€{remainingToPay.toLocaleString('hr-HR')}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">{t('supervision.subcontractor_details.gain_loss')}:</span>
                          <span className={`font-bold ${
                            subVariance > 0 ? 'text-red-600' :
                            subVariance < 0 ? 'text-green-600' :
                            'text-gray-900 dark:text-white'
                          }`}>
                            {subVariance > 0 ? '-' : subVariance < 0 ? '+' : ''}€{Math.abs(subVariance).toLocaleString('hr-HR')}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">{t('supervision.subcontractor_details.total_paid')}:</span>
                          <span className="font-bold text-green-600"> €{(subcontractor.invoice_total_paid || 0).toLocaleString('hr-HR')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">{t('supervision.site_management.phase_card.total_owed')}:</span>
                          <span className="font-bold text-orange-600">€{(subcontractor.invoice_total_owed || 0).toLocaleString('hr-HR')}</span>
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
                    <div className="grid grid-cols-4 gap-2">
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
            })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </div>
      )}
    </div>
  )
}
