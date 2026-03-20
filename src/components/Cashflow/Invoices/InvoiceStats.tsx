import React from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const isOutgoing = filterDirection === 'OUTGOING'

  return (
    <StatGrid columns={3}>
      <StatCard
        label={t('invoices.stats.total')}
        value={filteredTotalCount}
        icon={FileText}
        color="white"
      />
      <StatCard
        label={isOutgoing ? t('invoices.stats.inflow') : t('invoices.stats.unpaid')}
        value={formatAmount(filteredUnpaidAmount)}
        icon={isOutgoing ? TrendingUp : DollarSign}
        color={isOutgoing ? 'green' : 'red'}
      />
      <StatCard
        label={isOutgoing ? t('invoices.stats.total_inflow') : t('invoices.stats.total_unpaid')}
        value={formatAmount(totalUnpaidAmount)}
        icon={isOutgoing ? TrendingUp : DollarSign}
        color={isOutgoing ? 'teal' : 'yellow'}
      />
    </StatGrid>
  )
}
