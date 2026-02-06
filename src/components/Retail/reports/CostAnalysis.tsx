import React from 'react'
import { Briefcase, Hammer, Users } from 'lucide-react'
import type { SupplierReportData, SupplierTypeSummary, RetailReportData } from './retailReportTypes'

interface Props {
  data: RetailReportData
  formatCurrency: (n: number) => string
}

export const CostAnalysis: React.FC<Props> = ({ data, formatCurrency }) => {
  const { portfolio, supplier_types, suppliers } = data
  const totalCosts = portfolio.total_land_investment + portfolio.total_development_cost + portfolio.total_construction_cost

  const costBreakdown = [
    {
      label: 'Zemljista',
      amount: portfolio.total_land_investment,
      pct: totalCosts > 0 ? (portfolio.total_land_investment / totalCosts) * 100 : 0,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      label: 'Razvoj',
      amount: portfolio.total_development_cost,
      pct: totalCosts > 0 ? (portfolio.total_development_cost / totalCosts) * 100 : 0,
      color: 'bg-amber-500',
      textColor: 'text-amber-600'
    },
    {
      label: 'Gradnja',
      amount: portfolio.total_construction_cost,
      pct: totalCosts > 0 ? (portfolio.total_construction_cost / totalCosts) * 100 : 0,
      color: 'bg-teal-500',
      textColor: 'text-teal-600'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Briefcase className="w-5 h-5 text-gray-600" />
            <h3 className="text-base font-semibold text-gray-900">Struktura troskova</h3>
          </div>

          <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-gray-200 mb-5">
            {costBreakdown.map(item => (
              item.pct > 0 && (
                <div
                  key={item.label}
                  className={`${item.color} h-full transition-all duration-300`}
                  style={{ width: `${item.pct}%` }}
                />
              )
            ))}
          </div>

          <div className="space-y-3">
            {costBreakdown.map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${item.textColor}`}>{item.pct.toFixed(1)}%</span>
                  <span className="text-sm font-medium text-gray-900 w-28 text-right">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
            <div className="pt-3 mt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Ukupno</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(totalCosts)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Hammer className="w-5 h-5 text-gray-600" />
            <h3 className="text-base font-semibold text-gray-900">Po tipu dobavljaca</h3>
          </div>

          {supplier_types.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">Nema podataka</div>
          ) : (
            <div className="space-y-3">
              {supplier_types.map(st => (
                <SupplierTypeRow key={st.type} data={st} formatCurrency={formatCurrency} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Dobavljaci</h3>
            <p className="text-sm text-gray-500">{suppliers.length} dobavljaca</p>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nema podataka o dobavljacima</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dobavljac</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tip</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Ugovora</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Ugovoreno</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Placeno</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Preostalo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((supplier) => (
                  <SupplierRow key={supplier.id} supplier={supplier} formatCurrency={formatCurrency} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const typeColors: Record<string, string> = {
  'Geodet': 'bg-blue-100 text-blue-700',
  'Arhitekt': 'bg-green-100 text-green-700',
  'Projektant': 'bg-amber-100 text-amber-700',
  'Consultant': 'bg-cyan-100 text-cyan-700',
  'Other': 'bg-gray-100 text-gray-700'
}

function SupplierTypeRow({ data, formatCurrency }: {
  data: SupplierTypeSummary
  formatCurrency: (n: number) => string
}) {
  const unpaid = data.total_amount - data.total_paid
  const paidPct = data.total_amount > 0 ? (data.total_paid / data.total_amount) * 100 : 0

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[data.type] || typeColors.Other}`}>
            {data.type}
          </span>
          <span className="text-xs text-gray-500">{data.count} ugovora</span>
        </div>
        <span className="text-sm font-semibold text-gray-900">{formatCurrency(data.total_amount)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-teal-500 h-full rounded-full"
            style={{ width: `${Math.min(100, paidPct)}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">{paidPct.toFixed(0)}%</span>
      </div>
      <div className="flex justify-between mt-1 text-xs">
        <span className="text-teal-600">Plac. {formatCurrency(data.total_paid)}</span>
        {unpaid > 0 && <span className="text-orange-600">Nepl. {formatCurrency(unpaid)}</span>}
      </div>
    </div>
  )
}

function SupplierRow({ supplier, formatCurrency }: {
  supplier: SupplierReportData
  formatCurrency: (n: number) => string
}) {
  const remaining = supplier.total_amount - supplier.total_paid
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{supplier.name}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[supplier.supplier_type] || typeColors.Other}`}>
          {supplier.supplier_type}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm text-gray-700">{supplier.total_contracts}</td>
      <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(supplier.total_amount)}</td>
      <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">{formatCurrency(supplier.total_paid)}</td>
      <td className="px-4 py-3 text-right">
        <span className={`text-sm font-medium ${remaining > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
          {formatCurrency(remaining)}
        </span>
      </td>
    </tr>
  )
}
