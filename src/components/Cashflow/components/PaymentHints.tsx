import React from 'react'
import { useTranslation } from 'react-i18next'
import { InfoHint } from '../../ui'

// The two rule-heavy choices in the payment forms, explained where they are made. Both payment
// modals render these, so the wording cannot drift between them.

/** Beside "Izvor plaćanja": what each source means, kompenzacija above all. */
export const PaymentSourceHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="payments.source" label={t('payments.hints.source_title')} articleId="term-kompenzacija">
      <p>{t('payments.hints.source_accounts')}</p>
      <p>{t('payments.hints.source_kompenzacija')}</p>
    </InfoHint>
  )
}

/** Beside the cesija checkbox: who pays, from what, and what it cannot be combined with. */
export const CesijaHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="payments.cesija" label={t('payments.hints.cesija_title')} articleId="term-cesija">
      <p>{t('payments.hints.cesija_what')}</p>
      <p>{t('payments.hints.cesija_rules')}</p>
    </InfoHint>
  )
}
