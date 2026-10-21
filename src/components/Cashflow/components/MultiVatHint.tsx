import React from 'react'
import { useTranslation } from 'react-i18next'
import { InfoHint } from '../../ui'

/** Beside the first VAT base field of an invoice form: why there are four of them. */
export const MultiVatHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="invoices.multi_vat" label={t('invoices.hints.multi_vat_title')} articleId="term-multi-vat">
      <p>{t('invoices.hints.multi_vat_fields')}</p>
      <p>{t('invoices.hints.multi_vat_calc')}</p>
    </InfoHint>
  )
}
