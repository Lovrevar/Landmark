import React from 'react'
import { Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatEuroRounded, formatMonthYear } from '../../../utils/formatters'
import type { MonthlyData } from '../types/accountingDashboardTypes'
import { monthlyBarMax, barPercent } from '../utils/barScale'

interface Props {
  monthlyData: MonthlyData[]
}

interface MonthBarProps {
  value: number
  max: number
  barClass: string
  labelClass: string
}

/**
 * One bar and its € label. The label sits in a fixed-width column beside the track, not inside
 * it: inside an `overflow-hidden` track, a short bar clipped its own figure.
 */
const MonthBar: React.FC<MonthBarProps> = ({ value, max, barClass, labelClass }) => (
  <div className="flex-1 min-w-0 flex items-center gap-2">
    <div className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-700 rounded-full h-6 md:h-8 overflow-hidden" aria-hidden="true">
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${barPercent(value, max)}%` }} />
    </div>
    <span className={`w-24 shrink-0 text-right text-xs font-semibold tabular-nums ${labelClass}`}>
      {formatEuroRounded(value)}
    </span>
  </div>
)

const AccountingMonthlyTrendsSection: React.FC<Props> = ({ monthlyData }) => {
  const { t, i18n } = useTranslation()
  if (monthlyData.length === 0) return null

  // One denominator for the whole year, so bar length compares across months. It used to be
  // computed per month, which made every month's larger bar full width.
  const maxVal = monthlyBarMax(monthlyData)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('dashboards.accounting.monthly_trends', { year: new Date().getFullYear() })}
          </h2>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {monthlyData.map((data) => {
            const net = data.incoming - data.outgoing
            return (
              // Phone: month and net on one line, the two bars stacked beneath. From md up: one
              // row per month. `order` moves the net column without rendering it twice.
              <div key={data.month} className="flex flex-wrap items-center gap-y-2 md:flex-nowrap md:gap-x-3">
                <div className="order-1 w-1/2 md:w-24 md:shrink-0 text-sm font-medium text-gray-700 dark:text-gray-200">{formatMonthYear(data.month, i18n.language)}</div>
                <div className={`order-2 md:order-3 w-1/2 md:w-32 md:shrink-0 text-right text-sm font-semibold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {net >= 0 ? '+' : ''}{formatEuroRounded(net)}
                </div>
                <div className="order-3 md:order-2 w-full md:w-auto md:flex-1 md:min-w-0 flex flex-col md:flex-row gap-2 md:gap-3">
                  <MonthBar value={data.incoming} max={maxVal} barClass="bg-green-500" labelClass="text-green-700 dark:text-green-400" />
                  <MonthBar value={data.outgoing} max={maxVal} barClass="bg-red-500" labelClass="text-red-700 dark:text-red-400" />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.accounting.incoming')}</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded mr-2" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.accounting.outgoing')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountingMonthlyTrendsSection
