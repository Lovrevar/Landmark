import React, { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'
import { Table, Badge } from '../../ui'
import type { ProjectReportData } from './retailReportTypes'

interface Props {
  projects: ProjectReportData[]
  formatCurrency: (n: number) => string
}

type SortKey = 'name' | 'land_cost' | 'total_costs' | 'total_revenue' | 'profit' | 'roi'

export const ProjectPerformanceTable: React.FC<Props> = ({ projects, formatCurrency }) => {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'name')
    }
  }

  const sorted = [...projects].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    const cmp = typeof aVal === 'string'
      ? aVal.localeCompare(bVal as string)
      : (aVal as number) - (bVal as number)
    return sortAsc ? cmp : -cmp
  })

  const totals = projects.reduce((acc, p) => ({
    land_cost: acc.land_cost + p.land_cost,
    dev: acc.dev + p.development.budget_realized,
    constr: acc.constr + p.construction.budget_realized,
    revenue: acc.revenue + p.total_revenue,
    collected: acc.collected + p.total_collected,
    outstanding: acc.outstanding + p.total_outstanding,
    costs: acc.costs + p.total_costs,
    profit: acc.profit + p.profit
  }), { land_cost: 0, dev: 0, constr: 0, revenue: 0, collected: 0, outstanding: 0, costs: 0, profit: 0 })

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <Table.Th
      sortable
      className="font-semibold text-gray-600 hover:text-gray-900"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === field ? (
          sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </Table.Th>
  )

  const statusBadgeVariants: Record<string, 'gray' | 'blue' | 'green' | 'orange'> = {
    'Planning': 'gray',
    'In Progress': 'blue',
    'Completed': 'green',
    'On Hold': 'orange'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Pregled projekata</h3>
        <p className="text-sm text-gray-500 mt-1">Financijski pregled po projektu</p>
      </div>

      <Table className="rounded-none shadow-none border-0">
        <Table.Head>
          <Table.Tr hoverable={false}>
            <SortHeader label="Projekt" field="name" />
            <Table.Th className="font-semibold text-gray-600">Status</Table.Th>
            <SortHeader label="Zemljiste" field="land_cost" />
            <SortHeader label="Troskovi" field="total_costs" />
            <SortHeader label="Prihod" field="total_revenue" />
            <SortHeader label="Profit" field="profit" />
            <SortHeader label="ROI" field="roi" />
            <Table.Th className="w-10">{''}</Table.Th>
          </Table.Tr>
        </Table.Head>
        <Table.Body>
          {sorted.map((project) => (
            <React.Fragment key={project.id}>
              <Table.Tr
                className="transition-colors cursor-pointer"
                onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}
              >
                <Table.Td className="py-3">
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-xs text-gray-500">{project.location}</p>
                  </div>
                </Table.Td>
                <Table.Td className="py-3">
                  <Badge variant={statusBadgeVariants[project.status] || 'gray'} size="sm">
                    {project.status}
                  </Badge>
                </Table.Td>
                <Table.Td className="py-3 text-gray-700">{formatCurrency(project.land_cost)}</Table.Td>
                <Table.Td className="py-3 text-gray-700">{formatCurrency(project.total_costs)}</Table.Td>
                <Table.Td className="py-3 text-gray-700">{formatCurrency(project.total_revenue)}</Table.Td>
                <Table.Td className="py-3">
                  <span className={`text-sm font-semibold ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {project.profit >= 0 ? '+' : ''}{formatCurrency(project.profit)}
                  </span>
                </Table.Td>
                <Table.Td className="py-3">
                  <span className={`text-sm font-semibold ${project.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {project.roi.toFixed(1)}%
                  </span>
                </Table.Td>
                <Table.Td className="py-3 text-center">
                  {expandedId === project.id
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </Table.Td>
              </Table.Tr>
              {expandedId === project.id && (
                <Table.Tr hoverable={false}>
                  <Table.Td colSpan={8} className="px-4 py-4 bg-gray-50">
                    <ProjectExpandedDetail project={project} formatCurrency={formatCurrency} />
                  </Table.Td>
                </Table.Tr>
              )}
            </React.Fragment>
          ))}
        </Table.Body>
        <tfoot className="bg-gray-100 border-t-2 border-gray-300">
          <tr className="font-semibold text-gray-900">
            <td className="px-4 py-3">Ukupno ({projects.length})</td>
            <td className="px-4 py-3"></td>
            <td className="px-4 py-3 text-sm">{formatCurrency(totals.land_cost)}</td>
            <td className="px-4 py-3 text-sm">{formatCurrency(totals.costs)}</td>
            <td className="px-4 py-3 text-sm">{formatCurrency(totals.revenue)}</td>
            <td className="px-4 py-3">
              <span className={`text-sm ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.profit >= 0 ? '+' : ''}{formatCurrency(totals.profit)}
              </span>
            </td>
            <td className="px-4 py-3">
              <span className={`text-sm ${totals.costs > 0 ? (totals.profit / totals.costs * 100 >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                {totals.costs > 0 ? `${(totals.profit / totals.costs * 100).toFixed(1)}%` : '-'}
              </span>
            </td>
            <td className="px-4 py-3"></td>
          </tr>
        </tfoot>
      </Table>
    </div>
  )
}

function ProjectExpandedDetail({ project, formatCurrency }: {
  project: ProjectReportData
  formatCurrency: (n: number) => string
}) {
  const phases = [
    { label: 'Razvoj', data: project.development, color: 'blue' },
    { label: 'Gradnja', data: project.construction, color: 'amber' },
    { label: 'Prodaja', data: project.sales, color: 'green' }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Zemljiste</p>
        <p className="text-lg font-bold text-gray-900">{formatCurrency(project.land_cost)}</p>
        <p className="text-xs text-gray-500 mt-1">{project.total_area_m2.toLocaleString('hr-HR')} m2</p>
      </div>
      {phases.map(({ label, data }) => (
        <div key={label} className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Budz.:</span>
              <span className="font-medium">{formatCurrency(data.budget_allocated)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ugov.:</span>
              <span className="font-medium">{formatCurrency(data.contract_cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Plac.:</span>
              <span className="font-medium text-teal-600">{formatCurrency(data.budget_realized)}</span>
            </div>
            {data.unpaid > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Neplac.:</span>
                <span className="font-medium text-orange-600">{formatCurrency(data.unpaid)}</span>
              </div>
            )}
            <div className="text-xs text-gray-400 pt-1">{data.contracts_count} ugovora</div>
          </div>
        </div>
      ))}
    </div>
  )
}
