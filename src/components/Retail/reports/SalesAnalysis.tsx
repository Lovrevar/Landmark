import React from 'react'
import { DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import type { CustomerReportData, InvoiceSummary } from './retailReportTypes'

interface Props {
  customers: CustomerReportData[]
  invoices: InvoiceSummary
  formatCurrency: (n: number) => string
}

export const SalesAnalysis: React.FC<Props> = ({ customers, invoices, formatCurrency }) => {
  const totalContracts = customers.reduce((s, c) => s + c.total_contracts, 0)
  const totalAmount = customers.reduce((s, c) => s + c.total_amount, 0)
  const totalPaid = customers.reduce((s, c) => s + c.total_paid, 0)
  const totalRemaining = customers.reduce((s, c) => s + c.total_remaining, 0)
  const totalArea = customers.reduce((s, c) => s + c.total_area_m2, 0)
  const collectionRate = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-blue-600" />}
          label="Ugovoreno"
          value={formatCurrency(totalAmount)}
          sub={`${totalContracts} ugovora`}
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Naplaceno"
          value={formatCurrency(totalPaid)}
          sub={`${collectionRate.toFixed(1)}% naplata`}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          label="Za naplatu"
          value={formatCurrency(totalRemaining)}
          sub={`${totalArea.toLocaleString('hr-HR')} m2 prodano`}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          label="U kasnjenju"
          value={formatCurrency(invoices.overdue_amount)}
          sub={`${invoices.overdue} racuna`}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Kupci</h3>
            <p className="text-sm text-gray-500">{customers.length} kupaca</p>
          </div>
          <InvoiceStatusBar invoices={invoices} />
        </div>

        {customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nema podataka o kupcima</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kupac</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Ugovora</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Povrsina</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Ugovoreno</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Placeno</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Neplaceno</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Naplata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => {
                  const rate = customer.total_amount > 0
                    ? (customer.total_paid / customer.total_amount) * 100
                    : 0
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{customer.name}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {customer.total_contracts}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {customer.total_area_m2.toLocaleString('hr-HR')} m2
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatCurrency(customer.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                        {formatCurrency(customer.total_paid)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${customer.total_remaining > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                          {formatCurrency(customer.total_remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${rate >= 100 ? 'bg-green-500' : rate > 50 ? 'bg-blue-500' : 'bg-orange-500'}`}
                              style={{ width: `${Math.min(100, rate)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{rate.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-600 uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}

function InvoiceStatusBar({ invoices }: { invoices: InvoiceSummary }) {
  if (invoices.total === 0) return null

  const paidPct = (invoices.paid / invoices.total) * 100
  const pendingPct = (invoices.pending / invoices.total) * 100
  const overduePct = (invoices.overdue / invoices.total) * 100

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5 w-24 h-2 rounded-full overflow-hidden bg-gray-200">
        {paidPct > 0 && <div className="bg-green-500 h-full" style={{ width: `${paidPct}%` }} />}
        {pendingPct > 0 && <div className="bg-amber-400 h-full" style={{ width: `${pendingPct}%` }} />}
        {overduePct > 0 && <div className="bg-red-500 h-full" style={{ width: `${overduePct}%` }} />}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{invoices.paid}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{invoices.pending}</span>
        {invoices.overdue > 0 && (
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{invoices.overdue}</span>
        )}
      </div>
    </div>
  )
}
