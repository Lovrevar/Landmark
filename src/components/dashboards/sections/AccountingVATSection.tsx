import React from 'react'
import { PieChart } from 'lucide-react'
import { StatGrid } from '../../ui'
import type { VATStats } from '../types/accountingDashboardTypes'

interface Props {
  vatStats: VATStats
}

const AccountingVATSection: React.FC<Props> = ({ vatStats }) => {
  const currentMonthNet = vatStats.currentMonthVATCollected - vatStats.currentMonthVATPaid

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
      <div className="flex items-center mb-4">
        <PieChart className="w-6 h-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">PDV Overview</h2>
      </div>
      <StatGrid columns={4} className="gap-6">
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">PDV Collected ({new Date().getFullYear()})</p>
          <p className="text-2xl font-bold text-green-600">
            €{vatStats.totalVATCollected.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            This month: €{vatStats.currentMonthVATCollected.toLocaleString('en-US')}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">PDV Paid ({new Date().getFullYear()})</p>
          <p className="text-2xl font-bold text-red-600">
            €{vatStats.totalVATPaid.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            This month: €{vatStats.currentMonthVATPaid.toLocaleString('en-US')}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Net PDV Position</p>
          <p className={`text-2xl font-bold ${vatStats.netVAT >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            €{Math.abs(vatStats.netVAT).toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {vatStats.netVAT >= 0 ? 'To pay to tax office' : 'To receive from tax office'}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Current Month Net PDV</p>
          <p className={`text-2xl font-bold ${currentMonthNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            €{Math.abs(currentMonthNet).toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {currentMonthNet >= 0 ? 'To pay' : 'To receive'}
          </p>
        </div>
      </StatGrid>
    </div>
  )
}

export default AccountingVATSection
