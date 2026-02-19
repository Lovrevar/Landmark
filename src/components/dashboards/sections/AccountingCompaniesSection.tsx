import React from 'react'
import { Building2 } from 'lucide-react'
import type { TopCompany } from '../types/accountingDashboardTypes'

interface Props {
  topCompanies: TopCompany[]
}

const rankColors = [
  'bg-yellow-100 text-yellow-700',
  'bg-gray-200 text-gray-700',
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-blue-100 text-blue-700'
]

const AccountingCompaniesSection: React.FC<Props> = ({ topCompanies }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="p-6 border-b border-gray-200">
      <div className="flex items-center">
        <Building2 className="w-5 h-5 text-gray-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">
          Top 5 Companies by Net Balance ({new Date().getFullYear()})
        </h2>
      </div>
    </div>
    <div className="p-6">
      {topCompanies.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No company data available</p>
      ) : (
        <div className="space-y-4">
          {topCompanies.map((company, index) => (
            <div
              key={company.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${rankColors[index] || rankColors[3]}`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{company.name}</p>
                  <p className="text-xs text-gray-500">{company.invoiceCount} invoices</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${company.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  €{Math.abs(company.netBalance).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">
                  In: €{company.totalIncoming.toLocaleString('hr-HR')} | Out: €{company.totalOutgoing.toLocaleString('hr-HR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)

export default AccountingCompaniesSection
