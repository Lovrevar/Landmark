import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Calendar, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { Button, Badge } from '../../ui'
import StatCard from '../../ui/StatCard'
import { formatEuro } from '../../../utils/formatters'
import { useTranslation } from 'react-i18next'
import type { BankCredit } from '../../../types/investment'

interface Props {
  bankCredits: BankCredit[]
}

const InvestmentCreditsTable: React.FC<Props> = ({ bankCredits }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.investment.active_investments_table')}</h2>
          <Button variant="primary" onClick={() => navigate('/funding-credits')}>
            {t('dashboards.investment.view_all_credits')}
          </Button>
        </div>
      </div>
      <div className="p-6">
        {bankCredits.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('dashboards.investment.no_investments')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.no_investments_sub')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bankCredits.map((credit) => {
              const utilizationPercent = credit.amount > 0
                ? (Number(credit.used_amount || 0) / Number(credit.amount)) * 100
                : 0
              const maturityDays = credit.maturity_date
                ? differenceInDays(new Date(credit.maturity_date), new Date())
                : null
              const usageDays = credit.usage_expiration_date
                ? differenceInDays(new Date(credit.usage_expiration_date), new Date())
                : null
              const maturityWarning = maturityDays !== null && maturityDays <= 90 && maturityDays > 0
              const usageWarning = usageDays !== null && usageDays <= 90 && usageDays > 0

              return (
                <div key={credit.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-all dark:bg-gray-800/50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {credit.credit_name || `${credit.company?.name || 'Credit'} - ${credit.credit_type.replace('_', ' ')}`}
                        </h3>
                        {credit.project && <Badge variant="blue" size="sm">{credit.project.name}</Badge>}
                        {maturityWarning && <Badge variant="orange" size="sm">{t('dashboards.investment.maturing_soon')}</Badge>}
                        {usageWarning && <Badge variant="yellow" size="sm">{t('dashboards.investment.usage_expiring')}</Badge>}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">{credit.company?.name || 'Unknown Company'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{formatEuro(Number(credit.amount))}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.investment.investment_amount')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <StatCard label={t('dashboards.investment.used')} value={formatEuro(Number(credit.used_amount || 0))} color="blue" size="sm" />
                    <StatCard label={t('dashboards.investment.repaid')} value={formatEuro(Number(credit.repaid_amount || 0))} color="teal" size="sm" />
                    <StatCard
                      label={t('dashboards.investment.available_investments')}
                      value={formatEuro(Number(credit.amount) - Number(credit.used_amount || 0))}
                      color="green"
                      size="sm"
                    />
                    <StatCard label={t('dashboards.investment.outstanding')} value={formatEuro(Number(credit.outstanding_balance || 0))} color="red" size="sm" />
                    <StatCard label={t('dashboards.investment.interest_rate')} value={`${Number(credit.interest_rate || 0).toFixed(2)}%`} color="orange" size="sm" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{t('dashboards.investment.start_date')}</span>
                      </span>
                      <p className="font-medium text-gray-900 dark:text-white">{format(new Date(credit.start_date), 'MMM dd, yyyy')}</p>
                    </div>
                    {credit.maturity_date && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{t('dashboards.investment.maturity_date')}</span>
                        </span>
                        <p className={`font-medium ${maturityWarning ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
                          {format(new Date(credit.maturity_date), 'MMM dd, yyyy')}
                          {maturityDays !== null && maturityDays > 0 && (
                            <span className="text-xs ml-1">({maturityDays}d)</span>
                          )}
                        </p>
                      </div>
                    )}
                    {credit.usage_expiration_date && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{t('dashboards.investment.usage_expires')}</span>
                        </span>
                        <p className={`font-medium ${usageWarning ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>
                          {format(new Date(credit.usage_expiration_date), 'MMM dd, yyyy')}
                          {usageDays !== null && usageDays > 0 && (
                            <span className="text-xs ml-1">({usageDays}d)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.utilization')}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{utilizationPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          utilizationPercent >= 90 ? 'bg-red-500' :
                          utilizationPercent >= 70 ? 'bg-orange-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default InvestmentCreditsTable
