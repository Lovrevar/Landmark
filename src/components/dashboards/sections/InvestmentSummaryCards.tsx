import React from 'react'
import { Building2, TrendingUp, ArrowDownRight, PieChart } from 'lucide-react'
import type { FinancialSummary } from '../../../types/investment'

interface Props {
  financialSummary: FinancialSummary
}

const InvestmentSummaryCards: React.FC<Props> = ({ financialSummary }) => {
  const utilization = financialSummary.total_credit_lines > 0
    ? ((financialSummary.total_used_credit / financialSummary.total_credit_lines) * 100).toFixed(1)
    : '0'

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Portfolio Value</p>
            <p className="text-2xl font-bold text-gray-900">
              €{(financialSummary.total_portfolio_value / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center">
          <div className="p-2 bg-red-100 rounded-lg">
            <ArrowDownRight className="w-6 h-6 text-red-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Outstanding Debt</p>
            <p className="text-2xl font-bold text-gray-900">
              €{(financialSummary.total_debt / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Available Investments</p>
            <p className="text-2xl font-bold text-gray-900">
              €{(financialSummary.available_credit / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center">
          <div className="p-2 bg-teal-100 rounded-lg">
            <PieChart className="w-6 h-6 text-teal-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm text-gray-600">Investment Utilization</p>
            <p className="text-2xl font-bold text-gray-900">{utilization}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvestmentSummaryCards
