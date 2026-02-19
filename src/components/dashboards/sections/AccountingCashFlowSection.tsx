import React from 'react'
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { StatGrid } from '../../ui'
import type { CashFlowStats } from '../types/accountingDashboardTypes'

interface Props {
  cashFlowStats: CashFlowStats
}

const calculateChange = (current: number, previous: number): number =>
  previous === 0 ? 0 : ((current - previous) / previous) * 100

const AccountingCashFlowSection: React.FC<Props> = ({ cashFlowStats }) => {
  const incomingChange = calculateChange(
    cashFlowStats.currentMonthIncoming,
    cashFlowStats.previousMonthIncoming
  )
  const outgoingChange = calculateChange(
    cashFlowStats.currentMonthOutgoing,
    cashFlowStats.previousMonthOutgoing
  )
  const currentMonthNet = cashFlowStats.currentMonthIncoming - cashFlowStats.currentMonthOutgoing

  return (
    <StatGrid columns={3} className="gap-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Incoming ({new Date().getFullYear()})</p>
              <p className="text-2xl font-bold text-gray-900">
                €{cashFlowStats.totalIncoming.toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">This Month:</span>
          <div className="flex items-center">
            <span className="font-semibold text-gray-900 mr-2">
              €{cashFlowStats.currentMonthIncoming.toLocaleString('en-US')}
            </span>
            {incomingChange !== 0 && (
              <span className={`flex items-center ${incomingChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {incomingChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(incomingChange).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Outgoing ({new Date().getFullYear()})</p>
              <p className="text-2xl font-bold text-gray-900">
                €{cashFlowStats.totalOutgoing.toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">This Month:</span>
          <div className="flex items-center">
            <span className="font-semibold text-gray-900 mr-2">
              €{cashFlowStats.currentMonthOutgoing.toLocaleString('en-US')}
            </span>
            {outgoingChange !== 0 && (
              <span className={`flex items-center ${outgoingChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {outgoingChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(outgoingChange).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${cashFlowStats.netCashFlow >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <DollarSign className={`w-6 h-6 ${cashFlowStats.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Net Cash Flow ({new Date().getFullYear()})</p>
              <p className={`text-2xl font-bold ${cashFlowStats.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                €{Math.abs(cashFlowStats.netCashFlow).toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">This Month:</span>
          <span className={`font-semibold ${currentMonthNet >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            €{Math.abs(currentMonthNet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </StatGrid>
  )
}

export default AccountingCashFlowSection
