import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Building2, Settings, CreditCard } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases, SubcontractorWithPhase } from './types'
import { PhaseCard } from './PhaseCard'
import { fetchCreditAllocations, type CreditAllocation } from './services/siteService'
import { Button, Badge, EmptyState } from '../../ui'

interface ProjectDetailProps {
  project: ProjectWithPhases
  onBack: () => void
  onOpenPhaseSetup: () => void
  onEditPhaseSetup?: () => void
  onEditPhase: (phase: ProjectPhase) => void
  onDeletePhase: (phase: ProjectPhase) => void
  onAddSubcontractor: (phase: ProjectPhase) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
  canManagePayments?: boolean
  expandedPhases: Set<string>
  expandedContractTypes: Map<string, Set<string>>
  onTogglePhase: (phaseId: string) => void
  onToggleContractType: (phaseId: string, typeKey: string) => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onOpenPhaseSetup,
  onEditPhaseSetup,
  onEditPhase,
  onDeletePhase,
  onAddSubcontractor,
  onOpenPaymentHistory,
  onOpenInvoices,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor,
  onManageMilestones,
  canManagePayments = true,
  expandedPhases,
  expandedContractTypes,
  onTogglePhase,
  onToggleContractType
}) => {
  const { t } = useTranslation()
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [, setLoadingCredits] = useState(false)

  useEffect(() => {
    setLoadingCredits(true)
    fetchCreditAllocations(project.id)
      .then(setCreditAllocations)
      .catch(err => console.error('Error fetching project credit allocations:', err))
      .finally(() => setLoadingCredits(false))
  }, [project.id])

  return (
    <div>
      <div className="mb-6">
        <Button
          variant="ghost"
          icon={ArrowLeft}
          size="sm"
          onClick={onBack}
        >
          {t('supervision.site_management.project_detail.back_to_projects')}
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{project.location}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('supervision.site_management.project_detail.budget_label')}: €{project.budget.toLocaleString('hr-HR')}
              {project.has_phases && (
                <>
                  <span className="ml-2">
                    • {t('supervision.site_management.project_detail.allocated_label')}: €{project.total_budget_allocated.toLocaleString('hr-HR')}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant={
              project.status === 'Completed' ? 'green' :
              project.status === 'In Progress' ? 'blue' :
              'gray'
            } size="md">
              {project.status}
            </Badge>
            {!project.has_phases ? (
              <Button
                onClick={onOpenPhaseSetup}
                icon={Settings}
              >
                {t('supervision.site_management.setup_phases')}
              </Button>
            ) : (
              onEditPhaseSetup && (
                <Button
                  onClick={onEditPhaseSetup}
                  icon={Settings}
                >
                  {t('supervision.site_management.edit_phases')}
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Project Credits Section */}
      {creditAllocations.length > 0 && (
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center mb-4">
            <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('supervision.site_management.project_detail.allocated_funds')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creditAllocations.map((allocation) => {
              const credit = allocation.bank_credit
              const allocatedAmount = allocation.allocated_amount
              const usedAmount = allocation.used_amount
              const availableAmount = allocatedAmount - usedAmount
              const allocationUsedPercentage = allocatedAmount > 0
                ? (usedAmount / allocatedAmount) * 100
                : 0

              return (
                <div key={allocation.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{credit.credit_name}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{credit.company.name}</p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.credit_allocated')}:</span>
                      <span className="font-bold text-blue-600">€{allocatedAmount.toLocaleString('hr-HR')}</span>
                    </div>
                    {credit.disbursed_to_account ? null : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.credit_used')}:</span>
                          <span className="font-semibold text-orange-600">€{usedAmount.toLocaleString('hr-HR')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.credit_available')}:</span>
                          <span className={`font-semibold ${availableAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            €{availableAmount.toLocaleString('hr-HR')}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.interest_rate')}:</span>
                          <span className="font-semibold text-teal-600">{credit.interest_rate}%</span>
                        </div>
                      </>
                    )}
                  </div>

                  {allocation.description && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400">{allocation.description}</p>
                    </div>
                  )}

                  {!credit.disbursed_to_account && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">{t('supervision.site_management.project_detail.allocation_usage')}</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{allocationUsedPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            allocationUsedPercentage >= 100 ? 'bg-red-500' :
                            allocationUsedPercentage >= 80 ? 'bg-orange-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(allocationUsedPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {project.has_phases ? (
        <div className="space-y-6">
          {project.phases.map((phase) => {
            const phaseSubcontractors = project.subcontractors.filter(sub => sub.phase_id === phase.id)

            return (
              <PhaseCard
                key={phase.id}
                phase={phase}
                project={project}
                phaseSubcontractors={phaseSubcontractors}
                onEditPhase={onEditPhase}
                onDeletePhase={onDeletePhase}
                onAddSubcontractor={onAddSubcontractor}
                onOpenPaymentHistory={onOpenPaymentHistory}
                onOpenInvoices={onOpenInvoices}
                onEditSubcontractor={onEditSubcontractor}
                onOpenSubDetails={onOpenSubDetails}
                onDeleteSubcontractor={onDeleteSubcontractor}
                onManageMilestones={onManageMilestones}
                isExpanded={expandedPhases.has(phase.id)}
                expandedContractTypes={expandedContractTypes.get(phase.id) || new Set()}
                onToggleExpand={() => onTogglePhase(phase.id)}
                onToggleContractType={(typeKey) => onToggleContractType(phase.id, typeKey)}
              />
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title={t('supervision.site_management.project_detail.no_phases_title')}
          description={t('supervision.site_management.project_detail.no_phases_desc')}
          action={
            <Button onClick={onOpenPhaseSetup} icon={Settings}>
              {t('supervision.site_management.setup_phases')}
            </Button>
          }
        />
      )}

      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('supervision.site_management.project_detail.project_summary')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{project.subcontractors.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.total_subcontractors')}</div>
          </div>
          {canManagePayments && (
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {project.subcontractors.filter(s => {
                  const sub = s as SubcontractorWithPhase
                  if (sub.has_contract) {
                    return sub.budget_realized >= sub.cost && sub.cost > 0
                  }
                  return (sub.invoice_total_owed ?? 0) === 0 && (sub.invoice_total_paid ?? 0) > 0
                }).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('status.fully_paid')}</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">€{project.total_subcontractor_cost.toLocaleString('hr-HR')}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.contract_total')}</div>
          </div>
          {canManagePayments && (
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">
                €{project.subcontractors.reduce((sum, s) => sum + s.budget_realized, 0).toLocaleString('hr-HR')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('supervision.payment_history.total_paid')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
