import React, { useState, useEffect } from 'react'
import { LoadingSpinner, Button } from '../ui'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../contexts/ToastContext'
import {
  Banknote,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  FileDown
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { generateInvestmentReportPDF } from './investmentReportPdf'
import type { Company, Bank, BankCredit, FinancialSummary, RecentActivity } from '../../types/investment'
import * as investmentService from './services/investmentDashboardService'
import InvestmentSummaryCards from './sections/InvestmentSummaryCards'
import InvestmentCreditsTable from './sections/InvestmentCreditsTable'

const defaultFinancialSummary: FinancialSummary = {
  total_portfolio_value: 0, total_debt: 0, total_equity: 0,
  debt_to_equity_ratio: 0, weighted_avg_interest: 0, upcoming_maturities: 0,
  total_credit_lines: 0, available_credit: 0, total_used_credit: 0, total_repaid_credit: 0
}

const InvestmentDashboard: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCredits, setBankCredits] = useState<BankCredit[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>(defaultFinancialSummary)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const handleExportPDF = async () => {
    try {
      await generateInvestmentReportPDF(financialSummary, bankCredits, [])
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(t('dashboards.investment.pdf_error'))
    }
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const data = await investmentService.fetchInvestmentDashboardData()
      setCompanies(data.companies)
      setBanks(data.banks)
      setBankCredits(data.bankCredits)
      setRecentActivities(data.recentActivities)
      setFinancialSummary(data.financialSummary)
    } catch (error) {
      console.error('Error fetching investment data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message={t('dashboards.investment.loading')} />
  }

  const expiringUsageCount = bankCredits.filter(c =>
    c.usage_expiration_date &&
    differenceInDays(new Date(c.usage_expiration_date), new Date()) <= 90 &&
    differenceInDays(new Date(c.usage_expiration_date), new Date()) > 0
  ).length

  const noCriticalIssues = financialSummary.upcoming_maturities === 0 &&
    bankCredits.filter(c =>
      c.usage_expiration_date &&
      differenceInDays(new Date(c.usage_expiration_date), new Date()) <= 90
    ).length === 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboards.investment.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('dashboards.investment.subtitle')}</p>
        </div>
        <Button variant="danger" icon={FileDown} onClick={handleExportPDF} disabled={bankCredits.length === 0}>
          {t('dashboards.investment.export_pdf')}
        </Button>
      </div>

      <InvestmentSummaryCards financialSummary={financialSummary} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboards.investment.investment_overview')}</h3>
            <Banknote className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.total_investment_lines')}</span>
              <span className="font-medium dark:text-gray-200">€{(financialSummary.total_credit_lines / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.used_amount')}</span>
              <span className="font-medium text-blue-600">€{(financialSummary.total_used_credit / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.repaid_amount')}</span>
              <span className="font-medium text-green-600">€{(financialSummary.total_repaid_credit / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.avg_interest_rate')}</span>
              <span className="font-medium dark:text-gray-200">{financialSummary.weighted_avg_interest.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboards.investment.investment_partners')}</h3>
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.active_investors')}</span>
              <span className="font-medium dark:text-gray-200">{banks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.active_investments')}</span>
              <span className="font-medium dark:text-gray-200">{bankCredits.filter(c => c.status === 'active').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.total_companies')}</span>
              <span className="font-medium dark:text-gray-200">{companies.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('dashboards.investment.upcoming_maturities_label')}</span>
              <span className={`font-medium ${financialSummary.upcoming_maturities > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {financialSummary.upcoming_maturities}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboards.investment.critical_alerts')}</h3>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            {financialSummary.upcoming_maturities > 0 && (
              <div className="flex items-center p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
                <Clock className="w-4 h-4 text-orange-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-orange-800 dark:text-orange-300">
                  {t('dashboards.investment.investments_maturing', { count: financialSummary.upcoming_maturities })}
                </span>
              </div>
            )}
            {expiringUsageCount > 0 && (
              <div className="flex items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-yellow-800 dark:text-yellow-400">{t('dashboards.investment.usage_periods_expiring', { count: expiringUsageCount })}</span>
              </div>
            )}
            {noCriticalIssues && (
              <div className="flex items-center p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-green-800 dark:text-green-300">{t('dashboards.investment.no_critical_issues')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <InvestmentCreditsTable bankCredits={bankCredits} />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.investment.recent_activity')}</h2>
        </div>
        <div className="p-6">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>{t('dashboards.investment.no_recent_activity')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const isExpiry = activity.type === 'maturity' || activity.type === 'usage_expiring'
                const bgColor = activity.type === 'credit' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' :
                  activity.type === 'usage_expiring' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                  'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                const iconBg = activity.type === 'credit' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  activity.type === 'usage_expiring' ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-orange-100 dark:bg-orange-900/20'
                const iconColor = activity.type === 'credit' ? 'text-blue-600' :
                  activity.type === 'usage_expiring' ? 'text-yellow-600' : 'text-orange-600'
                const Icon = activity.type === 'credit' ? Banknote :
                  activity.type === 'usage_expiring' ? Clock : CreditCard

                return (
                  <div key={activity.id} className={`flex items-center space-x-4 p-4 border rounded-lg ${bgColor}`}>
                    <div className={`p-2 rounded-lg ${iconBg}`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{activity.description}</p>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(activity.date), isExpiry ? 'MMM dd, yyyy' : 'MMM dd')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvestmentDashboard
