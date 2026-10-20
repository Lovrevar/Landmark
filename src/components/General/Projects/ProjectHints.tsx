import React from 'react'
import { useTranslation } from 'react-i18next'
import { InfoHint } from '../../ui'

// The three project terms people ask about most, explained where the figure or heading stands.

/** Beside "Project phases": a phase is not a milestone, and its budget is not typed in. */
export const PhasesHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="projects.phases_vs_milestones" label={t('general_projects.hints.phases_title')} articleId="term-faza-vs-prekretnica">
      <p>{t('general_projects.hints.phases_what')}</p>
      <p>{t('general_projects.hints.phases_budget')}</p>
    </InfoHint>
  )
}

/** Beside "Realized": paid, not contracted. */
export const RealizedHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="projects.realized" label={t('general_projects.hints.realized_title')} articleId="term-realised-budget">
      <p>{t('general_projects.hints.realized_what')}</p>
      <p>{t('general_projects.hints.realized_update')}</p>
    </InfoHint>
  )
}

/** Beside the read-only budget field of the project form. */
export const BudgetFromTicHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="projects.budget_from_tic" label={t('general_projects.hints.budget_title')} articleId="term-budzet-iz-tic">
      <p>{t('general_projects.hints.budget_what')}</p>
      <p>{t('general_projects.hints.budget_missing')}</p>
    </InfoHint>
  )
}
