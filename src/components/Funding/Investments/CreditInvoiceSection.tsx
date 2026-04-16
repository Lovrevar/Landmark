import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, LoadingSpinner } from '../../ui'
import { format } from 'date-fns'
import { useLazySection } from './hooks/useLazySection'
import { INVOICE_STATUS_CONFIG } from './constants'
import { fetchCreditInvoices } from './services/creditService'

const COLOR_CLASSES = {
  emerald: { header: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', bold: 'text-emerald-700 dark:text-emerald-400', footer: 'bg-emerald-50 dark:bg-emerald-900/20' },
  amber:   { header: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-400',     bold: 'text-amber-700 dark:text-amber-400',     footer: 'bg-amber-50 dark:bg-amber-900/20'     },
  blue:    { header: 'bg-blue-50 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-300',       bold: 'text-blue-700 dark:text-blue-300',       footer: 'bg-blue-50 dark:bg-blue-900/30'       },
}

interface CreditInvoiceSectionProps {
  creditId: string
  invoiceType: 'OUTGOING_BANK' | 'INCOMING_BANK_EXPENSES' | 'INCOMING_BANK'
  title: string
  totalLabel: string
  paymentAmountLabel: string
  emptyMessage: string
  accentColor: 'emerald' | 'amber' | 'blue'
  icon: React.ComponentType<{ className?: string }>
  showAllocation?: boolean
}

const CreditInvoiceSection: React.FC<CreditInvoiceSectionProps> = ({
  creditId,
  invoiceType,
  title,
  totalLabel,
  paymentAmountLabel,
  emptyMessage,
  accentColor,
  icon: Icon,
  showAllocation = false,
}) => {
  const { t } = useTranslation()
  const colors = COLOR_CLASSES[accentColor]

  const fetcher = () => fetchCreditInvoices(creditId, invoiceType, showAllocation)

  const { expanded, loading, fetched, items: invoices, toggle } = useLazySection(fetcher)

  const totalPayment = invoices.reduce((sum, inv) => sum + (inv.payment_amount || 0), 0)
  const totalAmount  = invoices.reduce((sum, inv) => sum + inv.total_amount, 0)

  // Number of columns for tfoot colspan
  const baseColCount = showAllocation ? 7 : 6
  const tfootColspan = baseColCount - 1

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${colors.text}`} />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {title}
            {fetched && ` (${invoices.length})`}
          </h4>
        </div>
        <div className="flex items-center space-x-3">
          {fetched && invoices.length > 0 && (
            <span className={`text-sm font-semibold ${colors.bold}`}>
              {totalLabel}: €{totalPayment.toLocaleString('hr-HR')}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-4">
              <LoadingSpinner message={t('funding.credit_invoice_section.loading')} />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 px-4 py-3">
              {emptyMessage}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${colors.header} border-b border-gray-200 dark:border-gray-700`}>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {t('funding.credit_invoice_section.invoice_number_col')}
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {t('funding.credit_invoice_section.company_col')}
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {t('funding.credit_invoice_section.investor_col')}
                    </th>
                    {showAllocation && (
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {t('funding.credit_invoice_section.purpose_col')}
                      </th>
                    )}
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {t('funding.credit_invoice_section.issue_date_col')}
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {t('funding.credit_invoice_section.payment_date_col')}
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {paymentAmountLabel}
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {t('funding.credit_invoice_section.total_amount_col')}
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {t('funding.credit_invoice_section.status_col')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {invoices.map((inv) => {
                    const statusCfg = INVOICE_STATUS_CONFIG[inv.status] ?? { label: inv.status, variant: 'gray' as const }
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                          {inv.invoice_number}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200">
                          {inv.company_name ?? '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200">
                          {inv.bank_name ?? '-'}
                        </td>
                        {showAllocation && (
                          <td className="px-4 py-2.5">
                            {inv.allocation_label ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                                {inv.allocation_label}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          {format(new Date(inv.issue_date), 'dd.MM.yyyy')}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          {inv.payment_date
                            ? format(new Date(inv.payment_date), 'dd.MM.yyyy')
                            : '-'}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${colors.bold}`}>
                          {inv.payment_amount != null
                            ? `€${inv.payment_amount.toLocaleString('hr-HR')}`
                            : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">
                          €{inv.total_amount.toLocaleString('hr-HR')}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={statusCfg.variant}>
                            {statusCfg.label}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className={`${colors.footer} border-t border-gray-200 dark:border-gray-700`}>
                    <td colSpan={tfootColspan} className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {t('funding.credit_invoice_section.total_row')}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${colors.bold}`}>
                      €{totalPayment.toLocaleString('hr-HR')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-white">
                      €{totalAmount.toLocaleString('hr-HR')}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CreditInvoiceSection
