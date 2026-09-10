import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Building2, Settings, CreditCard, Layers, Tags } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases, SubcontractorWithPhase, SiteGrouping, VIEW_DIMENSIONS, CostClassification } from './types'
import { PhaseCard } from './PhaseCard'
import { ClassificationCard } from './ClassificationCard'
import { buildContractTree } from './utils/contractTree'
import { formatPhaseLabel } from '../../../utils/phaseLabel'
import { formatEuroRounded } from '../../../utils/formatters'
import { TICBudgetBadge } from './TICBudgetBadge'
import { ProjectSummaryBanner } from './ProjectSummaryBanner'
import { TreeGroup } from './TreeGroup'
import { fetchCreditAllocations, type CreditAllocation } from './services/siteService'
import { Button, Badge, EmptyState } from '../../ui'
import ProjectCategoryBadge from '../../Common/ProjectCategoryBadge'

interface ProjectDetailProps {
  project: ProjectWithPhases
  onBack: () => void
  onOpenPhaseSetup: () => void
  onEditPhaseSetup?: () => void
  onEditPhase: (phase: ProjectPhase) => void
  onDeletePhase: (phase: ProjectPhase) => void
  onAddSubcontractor: (phase: ProjectPhase, classificationId?: number | null) => void
  onEditClassificationBudgets: (phase: ProjectPhase) => void
  onEditClassificationBudget: (phaseId: string, classificationId: number) => void
  onManageClassifications: () => void
  classifications: CostClassification[]
  grouping: SiteGrouping
  onChangeGrouping: (grouping: SiteGrouping) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
  canManagePayments?: boolean
  expandedPhases: Set<string>
  /** Flat set of full path keys. Encodes the dimension order, so each view keeps its own state. */
  expandedNodes: Set<string>
  onTogglePhase: (phaseId: string) => void
  onToggleNode: (key: string) => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onOpenPhaseSetup,
  onEditPhaseSetup,
  onEditPhase,
  onDeletePhase,
  onAddSubcontractor,
  onEditClassificationBudgets,
  onEditClassificationBudget,
  onManageClassifications,
  classifications,
  grouping,
  onChangeGrouping,
  onOpenPaymentHistory,
  onOpenInvoices,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor,
  onManageMilestones,
  canManagePayments = true,
  expandedPhases,
  expandedNodes,
  onTogglePhase,
  onToggleNode
}) => {
  const { t } = useTranslation()

  // Shared by both views, so the two produce identical labels, ordering and money.
  const treeContext = React.useCallback((phases = project.phases) => ({
    phases,
    classifications,
    budgets: project.classification_budgets || [],
    labels: {
      unclassified: t('supervision.site_management.phase_card.unclassified'),
      uncategorizedType: t('supervision.site_management.phase_card.uncategorized'),
      phase: (p: ProjectPhase) => formatPhaseLabel(p, t('common.phase'))
    }
  }), [project.phases, project.classification_budgets, classifications, t])

  const isSinglePhase = project.phases.length === 1

  /** For a single-phase project the phase level is skipped entirely. */
  const singlePhaseNodes = React.useMemo(
    () => isSinglePhase
      ? buildContractTree(
          project.subcontractors as unknown as SubcontractorWithPhase[],
          VIEW_DIMENSIONS.byPhase.slice(1),
          treeContext()
        )
      : [],
    [isSinglePhase, project.subcontractors, treeContext]
  )

  const classificationNodes = React.useMemo(
    () => buildContractTree(
      project.subcontractors as unknown as SubcontractorWithPhase[],
      VIEW_DIMENSIONS.byClassification,
      treeContext()
    ),
    [project.subcontractors, treeContext]
  )
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
        <div className="mb-3">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            size="sm"
            onClick={onBack}
          >
            {t('supervision.site_management.project_detail.back_to_projects')}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{project.location}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('supervision.site_management.project_detail.budget_label')}:{' '}
              {project.tic_total && project.tic_total > 0
                ? formatEuroRounded(project.budget)
                : <span className="text-gray-400">—</span>}
              <TICBudgetBadge ticTotal={project.tic_total} />
              {project.has_phases && (
                <>
                  <span className="ml-2">
                    • {t('supervision.site_management.project_detail.allocated_label')}: {formatEuroRounded(project.total_budget_allocated)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <ProjectCategoryBadge category={project.category} size="md" />
            <Badge variant={
              project.status === 'Completed' ? 'green' :
              project.status === 'In Progress' ? 'blue' :
              'gray'
            } size="md">
              {project.status}
            </Badge>
            {project.has_phases && (
              <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => onChangeGrouping('byPhase')}
                  className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${
                    grouping === 'byPhase'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  {t('supervision.site_management.grouping.by_phase')}
                </button>
                <button
                  onClick={() => onChangeGrouping('byClassification')}
                  className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${
                    grouping === 'byClassification'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Tags className="w-4 h-4" />
                  {t('supervision.site_management.grouping.by_classification')}
                </button>
              </div>
            )}
            <Button variant="secondary" onClick={onManageClassifications} icon={Tags}>
              {t('supervision.cost_classification.manage_title')}
            </Button>
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
                      <span className="font-bold text-blue-600">{formatEuroRounded(allocatedAmount)}</span>
                    </div>
                    {credit.disbursed_to_account ? null : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.credit_used')}:</span>
                          <span className="font-semibold text-orange-600">{formatEuroRounded(usedAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.project_detail.credit_available')}:</span>
                          <span className={`font-semibold ${availableAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatEuroRounded(availableAmount)}
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

      {/* The project totalled, above the detail. Same five tiles as a phase card, so the two
          read the same way and the project total is visibly the sum of what is below it. */}
      <ProjectSummaryBanner project={project} canManagePayments={canManagePayments} />

      {project.has_phases ? (
        grouping === 'byPhase' ? (
          isSinglePhase ? (
            // One phase: show the cost classifications directly, as the screen did before
            // phases and classifications were separated. Wrapping a lone phase around them adds
            // a level to expand and tells the user nothing.
            <div className="space-y-3">
              {singlePhaseNodes.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title={t('supervision.site_management.phase_card.no_subs_title')}
                  description={t('supervision.site_management.phase_card.no_subs_desc')}
                />
              ) : singlePhaseNodes.map(node => (
                <TreeGroup
                  key={node.key}
                  node={node}
                  phase={project.phases[0]}
                  project={project}
                  depth={1}
                  expandedNodes={expandedNodes}
                  onToggleNode={onToggleNode}
                  onEditClassificationBudget={onEditClassificationBudget}
                  onAddSubcontractor={onAddSubcontractor}
                  onOpenPaymentHistory={onOpenPaymentHistory}
                  onOpenInvoices={onOpenInvoices}
                  onEditSubcontractor={onEditSubcontractor}
                  onOpenSubDetails={onOpenSubDetails}
                  onDeleteSubcontractor={onDeleteSubcontractor}
                  onManageMilestones={onManageMilestones}
                />
              ))}
            </div>
          ) : (
          <div className="space-y-6">
            {project.phases.map((phase) => {
              const phaseSubcontractors = project.subcontractors.filter(sub => sub.phase_id === phase.id)
              // Tree for this phase alone: the phase level is the card itself, so only the
              // levels below it are built here.
              const nodes = buildContractTree(
                phaseSubcontractors as unknown as SubcontractorWithPhase[],
                VIEW_DIMENSIONS.byPhase.slice(1),
                treeContext([phase])
              )

              return (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  project={project}
                  phaseSubcontractors={phaseSubcontractors}
                  nodes={nodes}
                  onEditPhase={onEditPhase}
                  onDeletePhase={onDeletePhase}
                  onAddSubcontractor={onAddSubcontractor}
                  onEditClassificationBudgets={onEditClassificationBudgets}
                  onEditClassificationBudget={onEditClassificationBudget}
                  onOpenPaymentHistory={onOpenPaymentHistory}
                  onOpenInvoices={onOpenInvoices}
                  onEditSubcontractor={onEditSubcontractor}
                  onOpenSubDetails={onOpenSubDetails}
                  onDeleteSubcontractor={onDeleteSubcontractor}
                  onManageMilestones={onManageMilestones}
                  isExpanded={expandedPhases.has(phase.id)}
                  expandedNodes={expandedNodes}
                  onToggleExpand={() => onTogglePhase(phase.id)}
                  onToggleNode={onToggleNode}
                />
              )
            })}
          </div>
          )
        ) : (
          <div className="space-y-6">
            {classificationNodes.map(node => (
              <ClassificationCard
                key={node.key}
                node={node}
                project={project}
                expandedNodes={expandedNodes}
                onToggleNode={onToggleNode}
                onEditClassificationBudget={onEditClassificationBudget}
                onAddSubcontractor={onAddSubcontractor}
                onOpenPaymentHistory={onOpenPaymentHistory}
                onOpenInvoices={onOpenInvoices}
                onEditSubcontractor={onEditSubcontractor}
                onOpenSubDetails={onOpenSubDetails}
                onDeleteSubcontractor={onDeleteSubcontractor}
                onManageMilestones={onManageMilestones}
              />
            ))}
          </div>
        )
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

    </div>
  )
}
