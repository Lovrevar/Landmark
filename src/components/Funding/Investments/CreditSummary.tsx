import React from 'react'
import { Building2, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Badge, StatGrid } from '../../ui'
import { isValidDate, parseLocalDate } from '../../../utils/dateOnly'
import { formatEuro, formatEuropean, NO_VALUE } from '../../../utils/formatters'
import { getCreditStatusDisplay } from '../Investors/utils/creditStatus'
import { getCreditTypeLabelKey } from '../Investors/utils/creditCalculations'
import { calculateCreditUsage } from './utils/creditUsage'

/**
 * The credit card's shared middle: the badges, the usage tiles with their progress bar, and the
 * details/dates grid. `Cashflow/Banks` and `Funding/Investments` render the same credits from the
 * same tables and used to carry two copies of all of this, which had drifted apart — different
 * wrong formulas behind the same "Dug" tile, different tile colours, one page's over-allocation
 * wording and not the other's. They keep only their own chrome (the bank grouping and expanders on
 * one, the allocation button on the other) and share this.
 *
 * One quantity, one name, one colour: money drawn from the line is **"Iskorišteno" in orange**
 * everywhere — the tile, the bar, the bar's legend and `AllocationRow`. It used to be "Isplaćeno"
 * in orange on the tile and "Iskorišteno" in the legend beside it, for the same number.
 */

export interface CreditSummaryCredit {
  amount: number
  used_amount?: number | null
  repaid_amount?: number | null
  outstanding_balance?: number | null
  interest_rate?: number | null
  credit_type: string
  credit_seniority?: string | null
  status: string
  start_date: string
  maturity_date: string | null
  usage_expiration_date?: string | null
  disbursed_to_account?: boolean | null
}

const formatDateOnly = (value: string | null | undefined): string =>
  isValidDate(value) ? format(parseLocalDate(value), 'dd.MM.yyyy') : NO_VALUE

/** Equity marker plus the translated status. Both used to be raw English enums. */
export const CreditBadges: React.FC<{ credit: CreditSummaryCredit }> = ({ credit }) => {
  const { t } = useTranslation()
  const status = getCreditStatusDisplay(credit.status)

  return (
    <>
      {credit.credit_type === 'equity' && (
        <Badge variant="purple">{t('funding.equity')}</Badge>
      )}
      <Badge variant={status?.variant ?? 'gray'}>
        {status ? t(status.labelKey) : credit.status}
      </Badge>
    </>
  )
}

interface CreditUsageTilesProps {
  credit: CreditSummaryCredit
  totalAllocated: number
  usedInAllocations: number
  unallocatedDisbursements: number
}

export const CreditUsageTiles: React.FC<CreditUsageTilesProps> = ({
  credit,
  totalAllocated,
  usedInAllocations,
  unallocatedDisbursements,
}) => {
  const { t } = useTranslation()
  const usage = calculateCreditUsage({
    amount: credit.amount,
    disbursedToAccount: credit.disbursed_to_account,
    totalAllocated,
    usedInAllocations,
    unallocatedDisbursements,
  })

  // "Dug" is coloured by the figure it prints. It used to follow a local `netUsed` that added the
  // drawdowns a second time (they are already inside `used_amount`), so a fully repaid credit
  // showed a red "€0,00".
  const outstanding = credit.outstanding_balance || 0
  const inDebt = outstanding > 0

  return (
    <>
      <StatGrid columns={4} className="mt-4">
        <div className="bg-slate-50 dark:bg-gray-700/50 p-3 rounded-lg">
          <p className="text-sm text-slate-700 dark:text-gray-200">{t('banks.index.credit.allocated')}</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{formatEuro(totalAllocated)}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
          <p className="text-sm text-orange-700 dark:text-orange-400">{t('banks.index.credit.used')}</p>
          <p className="text-lg font-bold text-orange-900 dark:text-orange-200">{formatEuro(usage.used)}</p>
        </div>
        <div className={`p-3 rounded-lg ${inDebt ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
          <p className={`text-sm ${inDebt ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {t('banks.index.credit.debt')}
          </p>
          <p className={`text-lg font-bold ${inDebt ? 'text-red-900 dark:text-red-200' : 'text-gray-900 dark:text-white'}`}>
            {formatEuro(outstanding)}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${usage.overCommitted ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
          <p className={`text-sm ${usage.overCommitted ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {t('banks.index.credit.unallocated')}
          </p>
          <p className={`text-lg font-bold ${usage.overCommitted ? 'text-red-900 dark:text-red-200' : 'text-green-900 dark:text-green-200'}`}>
            {formatEuro(usage.unallocated)}
          </p>
        </div>
      </StatGrid>

      <div className="mt-4">
        <div className="flex flex-wrap justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-200">{t('banks.index.credit.allocation_progress')}</span>
            {usage.usedPercent > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-orange-500"></span>
                {t('banks.index.credit.used_percent', { percent: usage.usedPercent.toFixed(1) })}
              </span>
            )}
            {usage.remainingAllocatedPercent > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-slate-500"></span>
                {t('banks.index.credit.allocated_percent', { percent: usage.remainingAllocatedPercent.toFixed(1) })}
              </span>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{usage.totalUsagePercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 flex overflow-hidden">
          <div
            className="h-3 bg-orange-500 transition-all duration-300"
            style={{ width: `${Math.min(100, usage.usedPercent)}%` }}
          />
          <div
            className={`h-3 transition-all duration-300 ${usage.overCommitted ? 'bg-red-600' : 'bg-slate-500'}`}
            style={{ width: `${Math.min(100 - Math.min(100, usage.usedPercent), usage.remainingAllocatedPercent)}%` }}
          />
        </div>
        {/* Drawdowns count towards the facility too: the warning used to look at allocations
            alone, so a line spent straight out of the credit went over in silence. */}
        {usage.overCommitted && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {t('banks.index.credit.over_allocated', { amount: formatEuropean(usage.overCommittedBy) })}
          </p>
        )}
      </div>
    </>
  )
}

/** Credit terms and dates. Dates are `dd.MM.yyyy` — `'MMM dd, yyyy'` printed English months. */
export const CreditDetailsGrid: React.FC<{ credit: CreditSummaryCredit }> = ({ credit }) => {
  const { t } = useTranslation()
  const typeKey = getCreditTypeLabelKey(credit.credit_type, credit.credit_seniority)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <Building2 className="w-5 h-5 mr-2" />
          {t('banks.index.credit.credit_details')}
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.loan_type_label')}</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {typeKey ? t(typeKey) : credit.credit_type.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.interest_rate_label')}</span>
            <span className="font-medium text-gray-900 dark:text-white">{credit.interest_rate ?? 0}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.outstanding_balance_label')}</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatEuro(credit.outstanding_balance || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.repaid_amount_label')}</span>
            <span className="font-medium text-green-600 dark:text-green-400">{formatEuro(credit.repaid_amount || 0)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          {t('banks.index.credit.dates_timeline')}
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.start_date_label')}</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatDateOnly(credit.start_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.maturity_date_label')}</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatDateOnly(credit.maturity_date)}</span>
          </div>
          {credit.usage_expiration_date && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('banks.index.credit.usage_expiration_label')}</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatDateOnly(credit.usage_expiration_date)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
