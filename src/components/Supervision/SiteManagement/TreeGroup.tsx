import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Edit2, Plus } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases, TreeNode } from './types'
import { remainingBudget } from './utils/contractTree'
import { ContractCard } from './ContractCard'
import { Button } from '../../ui'
import { formatEuroRounded } from '../../../utils/formatters'

interface TreeGroupProps {
  node: TreeNode
  phase: ProjectPhase | undefined
  project: ProjectWithPhases
  depth: number
  expandedNodes: Set<string>
  onToggleNode: (key: string) => void
  onEditClassificationBudget?: (phaseId: string, classificationId: number) => void
  onAddSubcontractor?: (phase: ProjectPhase, classificationId: number | null) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
}

const money = formatEuroRounded

const Metric: React.FC<{
  label: string
  children: React.ReactNode
  className?: string
  valueClassName?: string
  muted?: boolean
}> = ({ label, children, className = '', valueClassName, muted }) => (
  <div className={`flex-col items-end w-28 flex-shrink-0 ${className || 'flex'}`}>
    {children !== null && children !== undefined && (
      <>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-tight">
          {label}
        </span>
        <span className={`text-sm font-semibold leading-tight ${
          valueClassName ?? (muted ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white')
        }`}>
          {children}
        </span>
      </>
    )}
  </div>
)

/**
 * One collapsible level of the contract tree, rendered recursively.
 *
 * Deliberately dimension-agnostic: the same component draws a classification nested inside a
 * phase and a phase nested inside a classification. That is what lets the two views share an
 * implementation instead of drifting apart.
 */
export const TreeGroup: React.FC<TreeGroupProps> = ({
  node,
  phase,
  project,
  depth,
  expandedNodes,
  onToggleNode,
  onEditClassificationBudget,
  onAddSubcontractor,
  ...cardHandlers
}) => {
  const { t } = useTranslation()
  const isExpanded = expandedNodes.has(node.key)
  const isLeaf = node.children.length === 0

  // The (phase x classification) pair is the level that owns an editable sub-allocation. It is
  // the second level in both views, so the pencil always edits the same thing.
  const classificationId = node.dimension === 'classification' ? (node.id as number | null) : null
  const canEditBudget =
    depth > 0 &&
    node.dimension === 'classification' &&
    classificationId !== null &&
    phase !== undefined &&
    onEditClassificationBudget !== undefined

  const remaining = node.budget !== null ? remainingBudget(node.budget, node.rollup) : null
  // A budgeted-but-empty group is normal (that is how a phase is planned before anything is
  // contracted). Showing it "€0 / €0" was just noise, so those columns read "—" instead.
  const isEmpty = node.rollup.count === 0

  return (
    <div className={
      // Only the outermost level draws a box. Nested levels use indentation and a lighter
      // ground instead, so a three-deep tree does not become three nested borders.
      depth <= 1
        ? 'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'
        : 'rounded-lg overflow-hidden'
    }>
      <div className={`w-full flex items-center justify-between gap-4 transition-colors duration-200 ${
        depth <= 1
          ? 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
          : 'bg-gray-50/60 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700/40'
      }`}>
        <button
          onClick={() => onToggleNode(node.key)}
          className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-2.5 text-left"
        >
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />}
          <span className="font-semibold text-gray-900 dark:text-white truncate">{node.label}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">({node.rollup.count})</span>
        </button>

        {/* Fixed-width right-aligned columns with the label above the value: the figures then
            line up vertically down the whole list, which is what makes a dense tree scannable.
            Mirrors the tile pattern already used on the phase header. */}
        <div className="flex items-center gap-5 pr-2 tabular-nums">
          {/* All four slots are always rendered, empty where a level has no such figure, so the
              columns line up down the whole tree rather than shifting per row. */}
          <Metric label={t('supervision.site_management.phase_card.classification_budget')} className="hidden lg:flex">
            {node.budget !== null ? money(node.budget) : null}
          </Metric>
          <Metric
            label={t('supervision.site_management.phase_card.classification_remaining')}
            className="hidden xl:flex"
            valueClassName={remaining !== null && remaining < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-600 dark:text-green-400'}
          >
            {remaining !== null ? money(remaining) : null}
          </Metric>
          <Metric label={t('supervision.site_management.phase_card.cost')} muted={isEmpty}>
            {isEmpty ? '—' : money(node.rollup.contracted)}
          </Metric>
          <Metric
            label={t('common.paid')}
            muted={isEmpty}
            valueClassName={isEmpty ? undefined : 'text-teal-600 dark:text-teal-400'}
          >
            {isEmpty ? '—' : money(node.rollup.paid)}
          </Metric>

          {/* Fixed width whether or not the buttons exist, so rows without them keep the grid. */}
          <div className="flex items-center justify-end w-[72px] flex-shrink-0">
            {canEditBudget && (
              <Button
                variant="ghost"
                size="icon-sm"
                icon={Edit2}
                title={t('supervision.site_management.classification_budgets.title')}
                onClick={() => onEditClassificationBudget!(phase!.id, classificationId!)}
              />
            )}
            {node.dimension === 'classification' && phase && onAddSubcontractor && (
              <Button
                variant="ghost"
                size="icon-sm"
                icon={Plus}
                title={t('supervision.subcontractors.add')}
                onClick={() => onAddSubcontractor(phase, classificationId)}
              />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        isLeaf ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {node.contracts.map(subcontractor => (
              <ContractCard
                key={subcontractor.id}
                subcontractor={subcontractor as unknown as Subcontractor}
                phase={phase ?? project.phases[0]}
                project={project}
                {...cardHandlers}
              />
            ))}
          </div>
        ) : (
          <div className="pl-6 pb-3 pt-1 space-y-1.5">
            {node.children.map(child => (
              <TreeGroup
                key={child.key}
                node={child}
                // A phase node anywhere on the path fixes which phase the children belong to,
                // whichever view is active.
                phase={child.dimension === 'phase'
                  ? project.phases.find(p => p.id === child.id)
                  : phase}
                project={project}
                depth={depth + 1}
                expandedNodes={expandedNodes}
                onToggleNode={onToggleNode}
                onEditClassificationBudget={onEditClassificationBudget}
                onAddSubcontractor={onAddSubcontractor}
                {...cardHandlers}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}
