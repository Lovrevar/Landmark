import React, { useState, useEffect } from 'react'
import { LoadingSpinner, Button } from '../ui'
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
      await generateInvestmentReportPDF(financialSummary, bankCredits, [], companies)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF report')
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
    return <LoadingSpinner size="lg" message="Loading investment dashboard..." />
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
          <h1 className="text-3xl font-bold text-gray-900">Investment Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of funding, investments, and financial metrics</p>
        </div>
        <Button variant="danger" icon={FileDown} onClick={handleExportPDF} disabled={bankCredits.length === 0}>
          Export to PDF
        </Button>
      </div>

      <InvestmentSummaryCards financialSummary={financialSummary} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Investment Overview</h3>
            <Banknote className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Investment Lines:</span>
              <span className="font-medium">€{(financialSummary.total_credit_lines / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Used Amount:</span>
              <span className="font-medium text-blue-600">€{(financialSummary.total_used_credit / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Repaid Amount:</span>
              <span className="font-medium text-green-600">€{(financialSummary.total_repaid_credit / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg. Interest Rate:</span>
              <span className="font-medium">{financialSummary.weighted_avg_interest.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Investment Partners</h3>
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Investors:</span>
              <span className="font-medium">{banks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active Investments:</span>
              <span className="font-medium">{bankCredits.filter(c => c.status === 'active').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Companies:</span>
              <span className="font-medium">{companies.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Upcoming Maturities:</span>
              <span className={`font-medium ${financialSummary.upcoming_maturities > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {financialSummary.upcoming_maturities}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Critical Alerts</h3>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            {financialSummary.upcoming_maturities > 0 && (
              <div className="flex items-center p-2 bg-orange-50 border border-orange-200 rounded">
                <Clock className="w-4 h-4 text-orange-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-orange-800">
                  {financialSummary.upcoming_maturities} investment(s) maturing soon
                </span>
              </div>
            )}
            {expiringUsageCount > 0 && (
              <div className="flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-yellow-800">{expiringUsageCount} usage period(s) expiring</span>
              </div>
            )}
            {noCriticalIssues && (
              <div className="flex items-center p-2 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-green-800">No critical issues</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <InvestmentCreditsTable bankCredits={bankCredits} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const isExpiry = activity.type === 'maturity' || activity.type === 'usage_expiring'
                const bgColor = activity.type === 'credit' ? 'bg-blue-50 border-blue-200' :
                  activity.type === 'usage_expiring' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-orange-50 border-orange-200'
                const iconBg = activity.type === 'credit' ? 'bg-blue-100' :
                  activity.type === 'usage_expiring' ? 'bg-yellow-100' : 'bg-orange-100'
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
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                    </div>
                    <span className="text-sm text-gray-500">
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
