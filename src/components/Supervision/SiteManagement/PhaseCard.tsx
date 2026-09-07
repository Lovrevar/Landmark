import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2, Users, ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases, SubcontractorWithPhase, TreeNode } from './types'
import { rollupContracts, remainingBudget, unallocatedBudget } from './utils/contractTree'
import { formatPhaseLabel } from './utils/phaseLabel'
import { TreeGroup } from './TreeGroup'
import { Button, EmptyState } from '../../ui'
import { formatEuroRounded } from '../../../utils/formatters'

interface PhaseCardProps {
  phase: ProjectPhase
  project: ProjectWithPhases
  phaseSubcontractors: Subcontractor[]
  /** Children of this phase, already grouped by buildContractTree. */
  nodes: TreeNode[]
  onEditPhase: (phase: ProjectPhase) => void
  onDeletePhase: (phase: ProjectPhase) => void
  onAddSubcontractor: (phase: ProjectPhase, classificationId?: number | null) => void
  onEditClassificationBudgets: (phase: ProjectPhase) => void
  onEditClassificationBudget: (phaseId: string, classificationId: number) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
  isExpanded: boolean
  expandedNodes: Set<string>
  onToggleExpand: () => void
  onToggleNode: (key: string) => void
}

const money = formatEuroRounded

/**
 * A phase, with its cost classifications nested inside. Level 1 of the "by phase" view.
 *
 * The grouping and money math live in utils/contractTree so they can be tested and so the
 * classification-first view produces identical numbers from the same functions.
 */
export const PhaseCard: React.FC<PhaseCardProps> = ({
  phase,
  project,
  phaseSubcontractors,
  nodes,
  onEditPhase,
  onDeletePhase,
  onAddSubcontractor,
  onEditClassificationBudgets,
  onEditClassificationBudget,
  onManageMilestones,
  isExpanded,
  expandedNodes,
  onToggleExpand,
  onToggleNode,
  ...cardHandlers
}) => {
  const { t } = useTranslation()

  const contracts = phaseSubcontractors as unknown as SubcontractorWithPhase[]
  const rollup = rollupContracts(contracts)
  const remaining = remainingBudget(phase.budget_allocated, rollup)
  const unallocated = unallocatedBudget(phase, project.classification_budgets || [])

  const budgetUtilization = phase.budget_allocated > 0
    ? (rollup.paid / phase.budget_allocated) * 100
    : 0

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
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {formatPhaseLabel(phase, t('supervision.site_management.phase_card.phase_label'))}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {rollup.count} {rollup.count !== 1 ? t('common.subcontractors') : t('common.subcontractor')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{money(phase.budget_allocated)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('supervision.site_management.phase_card.forecasted_budget')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-md"
              icon={Wallet}
              title={t('supervision.site_management.classification_budgets.title')}
              onClick={() => onEditClassificationBudgets(phase)}
            />
            <Button variant="ghost" size="icon-md" icon={Edit2} onClick={() => onEditPhase(phase)} />
            <Button variant="outline-danger" size="icon-md" icon={Trash2} onClick={() => onDeletePhase(phase)} />
            <Button variant="success" icon={Plus} onClick={() => onAddSubcontractor(phase, null)}>
              {t('supervision.subcontractors.add')}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {t('supervision.site_management.phase_card.contracted_amount')}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{money(rollup.contracted)}</p>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg">
            <p className="text-sm text-teal-700 dark:text-teal-400">
              {t('supervision.site_management.phase_card.paid_out')}
            </p>
            <p className="text-lg font-bold text-teal-900 dark:text-teal-300">{money(rollup.paid)}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
            <p className="text-sm text-orange-700 dark:text-orange-400">
              {t('supervision.site_management.phase_card.unpaid_contracts')}
            </p>
            <p className="text-lg font-bold text-orange-900 dark:text-orange-300">{money(rollup.unpaid)}</p>
          </div>
          <div className={`p-3 rounded-lg ${remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
            <p className={`text-sm ${remaining < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
              {t('supervision.site_management.phase_card.remaining_budget')}
            </p>
            <p className={`text-lg font-bold ${remaining < 0 ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'}`}>
              {money(remaining)}
            </p>
          </div>
          {/* Phase budget not yet handed to any classification. Shown so the phase-first and
              classification-first views visibly reconcile — they differ by exactly this. */}
          <div className={`p-3 rounded-lg ${unallocated < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
            <p className={`text-sm ${unallocated < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
              {t('supervision.site_management.phase_card.unallocated')}
            </p>
            <p className={`text-lg font-bold ${unallocated < 0 ? 'text-red-900 dark:text-red-300' : 'text-blue-900 dark:text-blue-300'}`}>
              {money(unallocated)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('supervision.site_management.phase_card.budget_utilization')}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{budgetUtilization.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                budgetUtilization > 100 ? 'bg-red-600' : budgetUtilization > 80 ? 'bg-orange-600' : 'bg-teal-600'
              }`}
              style={{ width: `${Math.min(100, budgetUtilization)}%` }}
            ></div>
          </div>
          {budgetUtilization > 100 && (
            <p className="text-xs text-red-600 mt-1">
              {t('supervision.site_management.phase_card.over_budget_by')} {money(rollup.paid - phase.budget_allocated)}
            </p>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {nodes.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('supervision.site_management.phase_card.no_subs_title')}
              description={t('supervision.site_management.phase_card.no_subs_desc')}
            />
          ) : (
            <div className="space-y-4">
              {nodes.map(node => (
                <TreeGroup
                  key={node.key}
                  node={node}
                  phase={phase}
                  project={project}
                  depth={1}
                  expandedNodes={expandedNodes}
                  onToggleNode={onToggleNode}
                  onEditClassificationBudget={onEditClassificationBudget}
                  onAddSubcontractor={onAddSubcontractor}
                  onManageMilestones={onManageMilestones}
                  {...cardHandlers}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
