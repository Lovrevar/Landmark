import React from 'react'
import { PieChart } from 'lucide-react'
import { StatGrid } from '../../ui'
import StatCard from '../../ui/StatCard'
import { useTranslation } from 'react-i18next'
import type { VATStats } from '../types/accountingDashboardTypes'

interface Props {
  vatStats: VATStats
}

const AccountingVATSection: React.FC<Props> = ({ vatStats }) => {
  const { t } = useTranslation()
  const currentMonthNet = vatStats.currentMonthVATCollected - vatStats.currentMonthVATPaid
  const year = new Date().getFullYear()

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
      <div className="flex items-center mb-4">
        <PieChart className="w-6 h-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">{t('dashboards.accounting.vat_overview')}</h2>
      </div>
      <StatGrid columns={4} className="gap-6">
        <StatCard
          label={t('dashboards.accounting.vat_collected', { year })}
          value={`€${vatStats.totalVATCollected.toLocaleString('en-US')}`}
          subtitle={`${t('dashboards.accounting.this_month')}: €${vatStats.currentMonthVATCollected.toLocaleString('en-US')}`}
          color="white"
          size="md"
        />
        <StatCard
          label={t('dashboards.accounting.vat_paid', { year })}
          value={`€${vatStats.totalVATPaid.toLocaleString('en-US')}`}
          subtitle={`${t('dashboards.accounting.this_month')}: €${vatStats.currentMonthVATPaid.toLocaleString('en-US')}`}
          color="white"
          size="md"
        />
        <StatCard
          label={t('dashboards.accounting.net_vat_position')}
          value={`€${Math.abs(vatStats.netVAT).toLocaleString('en-US')}`}
          subtitle={vatStats.netVAT >= 0 ? t('dashboards.accounting.to_pay_tax') : t('dashboards.accounting.to_receive_tax')}
          color="white"
          size="md"
        />
        <StatCard
          label={t('dashboards.accounting.current_month_net_vat')}
          value={`€${Math.abs(currentMonthNet).toLocaleString('en-US')}`}
          subtitle={currentMonthNet >= 0 ? t('dashboards.accounting.to_pay') : t('dashboards.accounting.to_receive')}
          color="white"
          size="md"
        />
      </StatGrid>
    </div>
  )
}

export default AccountingVATSection
