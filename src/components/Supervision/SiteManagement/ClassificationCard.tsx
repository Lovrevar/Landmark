import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Subcontractor, ProjectPhase } from '../../../lib/supabase'
import { ProjectWithPhases, TreeNode } from './types'
import { remainingBudget } from './utils/contractTree'
import { TreeGroup } from './TreeGroup'
import { Button } from '../../ui'
import { formatEuroRounded } from '../../../utils/formatters'

interface ClassificationCardProps {
  node: TreeNode
  project: ProjectWithPhases
  expandedNodes: Set<string>
  onToggleNode: (key: string) => void
  onEditClassificationBudget: (phaseId: string, classificationId: number) => void
  onAddSubcontractor: (phase: ProjectPhase, classificationId: number | null) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
}

const money = formatEuroRounded

/**
 * A cost classification with the project's phases nested inside. Level 1 of the
 * "by cost classification" view.
 *
 * The budget here is a SUM across phases and is therefore read-only: the editable figure is the
 * (phase x classification) row one level down, which is the same row the phase-first view edits.
 */
export const ClassificationCard: React.FC<ClassificationCardProps> = ({
  node,
  project,
  expandedNodes,
  onToggleNode,
  onEditClassificationBudget,
  onAddSubcontractor,
  ...cardHandlers
}) => {
  const { t } = useTranslation()
  const isExpanded = expandedNodes.has(node.key)
  const remaining = node.budget !== null ? remainingBudget(node.budget, node.rollup) : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="primary"
              size="icon-lg"
              icon={isExpanded ? ChevronUp : ChevronDown}
              onClick={() => onToggleNode(node.key)}
            />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{node.label}</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {node.children.length} {node.children.length !== 1 ? t('common.phases') : t('common.phase')}
                {' · '}
                {node.rollup.count} {node.rollup.count !== 1 ? t('common.subcontractors') : t('common.subcontractor')}
              </p>
            </div>
          </div>
          {node.budget !== null && (
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{money(node.budget)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('supervision.site_management.phase_card.classification_budget')}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {t('supervision.site_management.phase_card.contracted_amount')}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{money(node.rollup.contracted)}</p>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg">
            <p className="text-sm text-teal-700 dark:text-teal-400">
              {t('supervision.site_management.phase_card.paid_out')}
            </p>
            <p className="text-lg font-bold text-teal-900 dark:text-teal-300">{money(node.rollup.paid)}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
            <p className="text-sm text-orange-700 dark:text-orange-400">
              {t('supervision.site_management.phase_card.unpaid_contracts')}
            </p>
            <p className="text-lg font-bold text-orange-900 dark:text-orange-300">{money(node.rollup.unpaid)}</p>
          </div>
          {remaining !== null && (
            <div className={`p-3 rounded-lg ${remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
              <p className={`text-sm ${remaining < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                {t('supervision.site_management.phase_card.remaining_budget')}
              </p>
              <p className={`text-lg font-bold ${remaining < 0 ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'}`}>
                {money(remaining)}
              </p>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-3">
          {node.children.map(child => (
            <TreeGroup
              key={child.key}
              node={child}
              phase={child.dimension === 'phase' ? project.phases.find(p => p.id === child.id) : undefined}
              project={project}
              depth={1}
              expandedNodes={expandedNodes}
              onToggleNode={onToggleNode}
              onEditClassificationBudget={onEditClassificationBudget}
              onAddSubcontractor={onAddSubcontractor}
              {...cardHandlers}
            />
          ))}
        </div>
      )}
    </div>
  )
}
