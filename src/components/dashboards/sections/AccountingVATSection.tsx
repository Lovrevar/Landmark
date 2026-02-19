import React from 'react'
import { PieChart } from 'lucide-react'
import { StatGrid } from '../../ui'
import StatCard from '../../ui/StatCard'
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
        <StatCard
          label={`PDV Collected (${new Date().getFullYear()})`}
          value={`€${vatStats.totalVATCollected.toLocaleString('en-US')}`}
          subtitle={`This month: €${vatStats.currentMonthVATCollected.toLocaleString('en-US')}`}
          color="white"
          size="md"
        />
        <StatCard
          label={`PDV Paid (${new Date().getFullYear()})`}
          value={`€${vatStats.totalVATPaid.toLocaleString('en-US')}`}
          subtitle={`This month: €${vatStats.currentMonthVATPaid.toLocaleString('en-US')}`}
          color="white"
          size="md"
        />
        <StatCard
          label="Net PDV Position"
          value={`€${Math.abs(vatStats.netVAT).toLocaleString('en-US')}`}
          subtitle={vatStats.netVAT >= 0 ? 'To pay to tax office' : 'To receive from tax office'}
          color="white"
          size="md"
        />
        <StatCard
          label="Current Month Net PDV"
          value={`€${Math.abs(currentMonthNet).toLocaleString('en-US')}`}
          subtitle={currentMonthNet >= 0 ? 'To pay' : 'To receive'}
          color="white"
          size="md"
        />
      </StatGrid>
    </div>
  )
}

export default AccountingVATSection
