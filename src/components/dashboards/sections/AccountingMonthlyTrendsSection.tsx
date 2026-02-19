import React from 'react'
import { Calendar } from 'lucide-react'
import type { MonthlyData } from '../types/accountingDashboardTypes'

interface Props {
  monthlyData: MonthlyData[]
}

const AccountingMonthlyTrendsSection: React.FC<Props> = ({ monthlyData }) => {
  if (monthlyData.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <Calendar className="w-5 h-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Monthly Cash Flow Trends ({new Date().getFullYear()})
          </h2>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {monthlyData.map((data) => {
            const maxVal = Math.max(data.incoming, data.outgoing, 1)
            const net = data.incoming - data.outgoing
            return (
              <div key={data.month} className="flex items-center">
                <div className="w-24 text-sm font-medium text-gray-700">{data.month}</div>
                <div className="flex-1 flex items-center space-x-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-green-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.min((data.incoming / maxVal) * 100, 100)}%` }}
                    >
                      <span className="text-xs font-semibold text-white">
                        €{data.incoming.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-red-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.min((data.outgoing / maxVal) * 100, 100)}%` }}
                    >
                      <span className="text-xs font-semibold text-white">
                        €{data.outgoing.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`w-32 text-right text-sm font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {net >= 0 ? '+' : '-'}€{Math.abs(net).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2" />
            <span className="text-sm text-gray-600">Incoming</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded mr-2" />
            <span className="text-sm text-gray-600">Outgoing</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountingMonthlyTrendsSection
