import React from 'react'
import { useTranslation } from 'react-i18next'
import { InfoHint } from '../../ui'

/**
 * In both "link units" dialogs (the apartment card and the Sales project grid): what linking a
 * garage or storage unit to an apartment means for the sale and the price.
 */
export const LinkedUnitsHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="apartments.link_units" label={t('apartments.hints.link_units_title')} articleId="term-unit-types">
      <p>{t('apartments.hints.link_units_package')}</p>
      <p>{t('apartments.hints.link_units_price')}</p>
    </InfoHint>
  )
}
