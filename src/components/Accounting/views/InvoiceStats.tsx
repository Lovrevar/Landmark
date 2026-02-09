import React from 'react'
import { FileText, DollarSign } from 'lucide-react'
import { StatCard, StatGrid } from '../../ui'

interface InvoiceStatsProps {
  filteredTotalCount: number
  filteredUnpaidAmount: number
  totalUnpaidAmount: number
}

export const InvoiceStats: React.FC<InvoiceStatsProps> = ({
  filteredTotalCount,
  filteredUnpaidAmount,
  totalUnpaidAmount
}) => {
  return (
    <StatGrid columns={3}>
      <StatCard
        label="Prikazano računa"
        value={filteredTotalCount}
        icon={FileText}
        color="white"
      />
      <StatCard
        label="Neplaćeno"
        value={`€${new Intl.NumberFormat('hr-HR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(filteredUnpaidAmount)}`}
        icon={DollarSign}
        color="red"
      />
      <StatCard
        label="Ukupno Neplaćeno"
        value={`€${new Intl.NumberFormat('hr-HR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(totalUnpaidAmount)}`}
        icon={DollarSign}
        color="yellow"
      />
    </StatGrid>
  )
}
