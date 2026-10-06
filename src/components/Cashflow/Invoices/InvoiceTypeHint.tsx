import React from 'react'
import { useTranslation } from 'react-i18next'
import { InfoHint } from '../../ui'
import { ALL_INVOICE_TYPES, getInvoiceTypeLabel, getInvoiceTypeLongLabel } from '../services/invoiceHelpers'

/**
 * The legend for the bracketed invoice-type codes, built from the same vocabulary that prints
 * them. It sits in the Type column header on desktop and beside the type filter on phones, where
 * the table becomes cards and has no header row to carry it.
 */
export const InvoiceTypeHint: React.FC = () => {
  const { t } = useTranslation()
  return (
    <InfoHint hintId="invoices.type" label={t('invoices.hints.type_title')} articleId="term-invoice-types" widthClassName="w-[23rem]">
      <p>{t('invoices.hints.type_intro')}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {ALL_INVOICE_TYPES.map(type => (
          <React.Fragment key={type}>
            <dt className="font-semibold whitespace-nowrap">{getInvoiceTypeLabel(type, t)}</dt>
            <dd className="whitespace-nowrap">{getInvoiceTypeLongLabel(type, t)}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p>{t('invoices.hints.type_colour')}</p>
    </InfoHint>
  )
}
