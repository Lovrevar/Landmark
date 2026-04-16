import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../../Common/CurrencyInput'
import { VatCalculation } from '../retailInvoiceTypes'

interface RetailInvoiceCalculationSummaryProps {
  base_amount_1: number
  base_amount_2: number
  base_amount_3: number
  base_amount_4: number
  calculation: VatCalculation
}

export const RetailInvoiceCalculationSummary: React.FC<RetailInvoiceCalculationSummaryProps> = ({
  base_amount_1,
  base_amount_2,
  base_amount_3,
  base_amount_4,
  calculation
}) => {
  const { t } = useTranslation()
  if (base_amount_1 === 0 && base_amount_2 === 0 && base_amount_3 === 0 && base_amount_4 === 0) {
    return null
  }

  return (
    <div className="col-span-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('invoices.form.vat_preview')}</div>

      {base_amount_1 > 0 && (
        <div className="space-y-1 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.base_vat25')}</span>
            <span className="font-medium">€{formatCurrency(base_amount_1)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">PDV 25%:</span>
            <span className="font-medium">€{formatCurrency(calculation.vat1)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.subtotal')}</span>
            <span>€{formatCurrency(calculation.subtotal1)}</span>
          </div>
        </div>
      )}

      {base_amount_2 > 0 && (
        <div className="space-y-1 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.base_vat13')}</span>
            <span className="font-medium">€{formatCurrency(base_amount_2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">PDV 13%:</span>
            <span className="font-medium">€{formatCurrency(calculation.vat2)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.subtotal')}</span>
            <span>€{formatCurrency(calculation.subtotal2)}</span>
          </div>
        </div>
      )}

      {base_amount_4 > 0 && (
        <div className="space-y-1 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.base_vat5')}</span>
            <span className="font-medium">€{formatCurrency(base_amount_4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">PDV 5%:</span>
            <span className="font-medium">€{formatCurrency(calculation.vat4)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.subtotal')}</span>
            <span>€{formatCurrency(calculation.subtotal4)}</span>
          </div>
        </div>
      )}

      {base_amount_3 > 0 && (
        <div className="space-y-1 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.base_vat0')}</span>
            <span className="font-medium">€{formatCurrency(base_amount_3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">PDV 0%:</span>
            <span className="font-medium">€0.00</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-600 dark:text-gray-400">{t('invoices.form.subtotal')}</span>
            <span>€{formatCurrency(calculation.subtotal3)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between text-base font-bold pt-2">
        <span>{t('invoices.form.grand_total')}</span>
        <span>€{formatCurrency(calculation.totalAmount)}</span>
      </div>
    </div>
  )
}
