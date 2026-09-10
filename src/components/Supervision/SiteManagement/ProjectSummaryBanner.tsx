import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatEuroRounded as money } from '../../../utils/formatters'
import { ProjectWithPhases, SubcontractorWithPhase } from './types'
import { rollupContracts, remainingBudget, isFullySettled } from './utils/contractTree'

interface Props {
  project: ProjectWithPhases
  /** Paid figures are hidden from roles that cannot manage payments, as elsewhere on this screen. */
  canManagePayments: boolean
}

/**
 * The whole project in one strip, above the phase cards.
 *
 * Deliberately the same five tiles as a phase card, in the same order and colours: the project
 * is just one level up, and reading it should take no new effort. The figures come from
 * `rollupContracts` — the same function the phase cards and every tree node use — so this total
 * is by construction the sum of what is displayed beneath it rather than a second opinion.
 */
export const ProjectSummaryBanner: React.FC<Props> = ({ project, canManagePayments }) => {
  const { t } = useTranslation()

  const contracts = project.subcontractors as unknown as SubcontractorWithPhase[]
  const rollup = rollupContracts(contracts)
  const hasBudget = project.tic_total !== null && project.tic_total > 0
  const remaining = remainingBudget(project.budget, rollup)
  const settled = contracts.filter(isFullySettled).length

  // Only meaningful when the TIC is actually phased. An unphased TIC puts every line into
  // `notPhased`, which would label the entire plan "not phased" — true, and useless.
  const notPhased = project.tic_not_phased
  const showNotPhased = project.tic_phase_count > 0 && notPhased > 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      {/* No budget figure here: the header directly above already carries it with its TIC
          badge, and repeating it is the duplication this banner exists to remove. */}
      <div className="flex items-baseline gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('supervision.site_management.project_detail.project_summary')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {contracts.length} {t('common.subcontractors').toLowerCase()}
          {canManagePayments && ` · ${settled} ${t('status.fully_paid').toLowerCase()}`}
        </p>
      </div>

      <div className={`mt-4 grid grid-cols-1 gap-4 ${showNotPhased ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {t('supervision.site_management.phase_card.contracted_amount')}
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{money(rollup.contracted)}</p>
        </div>

        {canManagePayments && (
          <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg">
            <p className="text-sm text-teal-700 dark:text-teal-400">
              {t('supervision.site_management.phase_card.paid_out')}
            </p>
            <p className="text-lg font-bold text-teal-900 dark:text-teal-300">{money(rollup.paid)}</p>
          </div>
        )}

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
            {hasBudget ? money(remaining) : '—'}
          </p>
        </div>

        {showNotPhased && (
          /* The only thing on screen explaining why the phase budgets stop short of the project
             budget: this money belongs to the project but to no single phase. */
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {t('supervision.site_management.budget_matrix.not_phased')}
            </p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-300">{money(notPhased)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
