import React from 'react'
import { useTranslation } from 'react-i18next'
import { InfoHint } from '../ui'

/**
 * Beside the "no contract" choice: what working without a signed contract changes. Shared by the
 * Supervision subcontractor form and the Cashflow "link supplier to project" form, which both
 * create such an engagement.
 */
export const NoContractHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="contracts.no_contract" label={t('common.hints.no_contract_title')} articleId="term-has-contract">
      <p>{t('common.hints.no_contract_what')}</p>
      <p>{t('common.hints.no_contract_tracking')}</p>
    </InfoHint>
  )
}
