import React from 'react'
import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TopCompany } from '../types/accountingDashboardTypes'

interface Props {
  topCompanies: TopCompany[]
}

const rankColors = [
  'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
  'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
  'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
]

const AccountingCompaniesSection: React.FC<Props> = ({ topCompanies }) => {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <Building2 className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('dashboards.accounting.top_companies', { year })}
          </h2>
        </div>
      </div>
      <div className="p-6">
        {topCompanies.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('dashboards.accounting.no_company_data')}</p>
        ) : (
          <div className="space-y-4">
            {topCompanies.map((company, index) => (
              <div
                key={company.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${rankColors[index] || rankColors[3]}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{company.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{company.invoiceCount} {t('dashboards.accounting.invoices_label')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${company.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{Math.abs(company.netBalance).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('dashboards.accounting.in_out_label', { incoming: company.totalIncoming.toLocaleString('hr-HR'), outgoing: company.totalOutgoing.toLocaleString('hr-HR') })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AccountingCompaniesSection
