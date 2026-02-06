import React from 'react'
import { Briefcase, Hammer, Users } from 'lucide-react'
import { Table, Badge, EmptyState } from '../../ui'
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
            <EmptyState title="Nema podataka" />
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
          <EmptyState title="Nema podataka o dobavljacima" />
        ) : (
          <Table className="rounded-none shadow-none border-0">
            <Table.Head>
              <Table.Tr hoverable={false}>
                <Table.Th>Dobavljac</Table.Th>
                <Table.Th>Tip</Table.Th>
                <Table.Th className="text-right">Ugovora</Table.Th>
                <Table.Th className="text-right">Ugovoreno</Table.Th>
                <Table.Th className="text-right">Placeno</Table.Th>
                <Table.Th className="text-right">Preostalo</Table.Th>
              </Table.Tr>
            </Table.Head>
            <Table.Body>
              {suppliers.map((supplier) => (
                <SupplierRow key={supplier.id} supplier={supplier} formatCurrency={formatCurrency} />
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </div>
  )
}

const typeBadgeVariants: Record<string, 'blue' | 'green' | 'orange' | 'teal' | 'gray'> = {
  'Geodet': 'blue',
  'Arhitekt': 'green',
  'Projektant': 'orange',
  'Consultant': 'teal',
  'Other': 'gray'
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
          <Badge variant={typeBadgeVariants[data.type] || 'gray'} size="sm">
            {data.type}
          </Badge>
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
    <Table.Tr className="transition-colors">
      <Table.Td className="py-3 font-medium">{supplier.name}</Table.Td>
      <Table.Td className="py-3">
        <Badge variant={typeBadgeVariants[supplier.supplier_type] || 'gray'} size="sm">
          {supplier.supplier_type}
        </Badge>
      </Table.Td>
      <Table.Td className="py-3 text-right text-gray-700">{supplier.total_contracts}</Table.Td>
      <Table.Td className="py-3 text-right text-gray-700">{formatCurrency(supplier.total_amount)}</Table.Td>
      <Table.Td className="py-3 text-right text-green-600 font-medium">{formatCurrency(supplier.total_paid)}</Table.Td>
      <Table.Td className="py-3 text-right">
        <span className={`text-sm font-medium ${remaining > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
          {formatCurrency(remaining)}
        </span>
      </Table.Td>
    </Table.Tr>
  )
}
