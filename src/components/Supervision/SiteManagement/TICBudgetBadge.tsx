import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  /** The project's TIC investment total, or null when it has no TIC. */
  ticTotal: number | null
}

/**
 * Says where a project's budget comes from — or that it has none yet.
 *
 * The TIC is now the only writer of planned budget, so a budget cannot drift from its plan and
 * there is nothing to warn about. What is worth saying is the opposite case: a project with no
 * TIC has no plan, and every budget figure on screen for it is meaningless until one exists.
 */
export const TICBudgetBadge: React.FC<Props> = ({ ticTotal }) => {
  const { t } = useTranslation()

  if (ticTotal !== null && ticTotal > 0) {
    return (
      <span className="ml-2 text-green-600 dark:text-green-400">
        ✓ {t('supervision.site_management.project_detail.budget_from_tic')}
      </span>
    )
  }

  return (
    <span className="ml-2 text-orange-600 dark:text-orange-400">
      ⚠ {t('general_projects.budget_not_set')}
    </span>
  )
}
