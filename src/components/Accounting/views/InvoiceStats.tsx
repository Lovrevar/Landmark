import React from 'react'
import { FileText, TrendingUp, DollarSign } from 'lucide-react'
import { StatCard, StatGrid } from '../../ui'

const formatAmount = (amount: number) =>
  `€${new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`

interface InvoiceStatsProps {
  filteredTotalCount: number
  filteredUnpaidAmount: number
  totalUnpaidAmount: number
  filterDirection: 'INCOMING' | 'OUTGOING'
}

export const InvoiceStats: React.FC<InvoiceStatsProps> = ({
  filteredTotalCount,
  filteredUnpaidAmount,
  totalUnpaidAmount,
  filterDirection
}) => {
  const isOutgoing = filterDirection === 'OUTGOING'

  return (
    <StatGrid columns={3}>
      <StatCard
        label="Ukupno računa"
        value={filteredTotalCount}
        icon={FileText}
        color="white"
      />
      <StatCard
        label={isOutgoing ? 'Priljev' : 'Neplaćeno'}
        value={formatAmount(filteredUnpaidAmount)}
        icon={isOutgoing ? TrendingUp : DollarSign}
        color={isOutgoing ? 'green' : 'red'}
      />
      <StatCard
        label={isOutgoing ? 'Ukupni Priljev' : 'Ukupno Neplaćeno'}
        value={formatAmount(totalUnpaidAmount)}
        icon={isOutgoing ? TrendingUp : DollarSign}
        color={isOutgoing ? 'teal' : 'yellow'}
      />
    </StatGrid>
  )
}
