import React from 'react'
import { DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, Activity, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { StatGrid } from '../../ui'
import { format } from 'date-fns'
import type { FinancialMetrics } from '../types/directorTypes'

interface Props {
  metrics: FinancialMetrics
}

const DirectorFinancialSection: React.FC<Props> = ({ metrics }) => (
  <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl shadow-lg border border-blue-200 p-6">
    <div className="flex items-center mb-6">
      <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
      <h2 className="text-2xl font-bold text-gray-900">Financial Overview</h2>
    </div>
    <StatGrid columns={5}>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-3xl font-bold text-green-600">€{(metrics.total_revenue / 1000000).toFixed(2)}M</p>
        <p className="text-xs text-gray-500 mt-1">From all sales</p>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">Total Expenses</p>
          <TrendingDown className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-3xl font-bold text-red-600">€{(metrics.total_expenses / 1000000).toFixed(2)}M</p>
        <p className="text-xs text-gray-500 mt-1">All payments made</p>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">Net Profit</p>
          <Wallet className="w-5 h-5 text-blue-600" />
        </div>
        <p className={`text-3xl font-bold ${metrics.total_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
          €{(metrics.total_profit / 1000000).toFixed(2)}M
        </p>
        <p className="text-xs text-gray-500 mt-1">{metrics.profit_margin.toFixed(1)}% margin</p>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">Total Debt</p>
          <CreditCard className="w-5 h-5 text-orange-600" />
        </div>
        <p className="text-3xl font-bold text-orange-600">€{(metrics.total_debt / 1000000).toFixed(2)}M</p>
        <p className="text-xs text-gray-500 mt-1">Outstanding balance</p>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">Cash Flow (Month)</p>
          <Activity className="w-5 h-5 text-teal-600" />
        </div>
        <p className="text-3xl font-bold text-teal-600">€{(metrics.cash_flow_current_month / 1000).toFixed(0)}K</p>
        <p className="text-xs text-gray-500 mt-1">{format(new Date(), 'MMMM')}</p>
      </div>
    </StatGrid>
    <StatGrid columns={3} className="mt-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-600">Debt/Equity Ratio</p>
            <p className={`text-xl font-bold ${
              metrics.debt_to_equity_ratio > 2 ? 'text-red-600' :
              metrics.debt_to_equity_ratio > 1 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {metrics.debt_to_equity_ratio.toFixed(2)}x
            </p>
          </div>
          <PieChart className="w-8 h-8 text-gray-400" />
        </div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-600">Receivables</p>
            <p className="text-xl font-bold text-blue-600">€{(metrics.outstanding_receivables / 1000).toFixed(0)}K</p>
          </div>
          <ArrowUpRight className="w-8 h-8 text-blue-400" />
        </div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-600">Payables</p>
            <p className="text-xl font-bold text-orange-600">€{(metrics.outstanding_payables / 1000000).toFixed(3)}M</p>
          </div>
          <ArrowDownRight className="w-8 h-8 text-orange-400" />
        </div>
      </div>
    </StatGrid>
  </div>
)

export default DirectorFinancialSection
