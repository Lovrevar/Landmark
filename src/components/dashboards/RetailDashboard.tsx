import React, { useState, useEffect } from 'react'
import { LoadingSpinner } from '../ui'
import { BarChart3, MapPin, Users, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { DashboardStats, OverdueInvoice } from './types/retailDashboardTypes'
import { fetchRetailDashboardData } from './services/retailDashboardService'

const defaultStats: DashboardStats = {
  total_plots: 0,
  total_area: 0,
  total_invested: 0,
  total_customers: 0,
  total_revenue: 0,
  total_paid: 0,
  total_remaining: 0,
  profit: 0
}

const RetailDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([])

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const { stats: s, overdueInvoices: overdue } = await fetchRetailDashboardData()
      setStats(s)
      setOverdueInvoices(overdue)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Retail Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Pregled poslovanja sa zemljištima</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <MapPin className="w-8 h-8 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Zemljišta</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total_plots}</p>
          <p className="text-sm text-gray-600 mt-1">{stats.total_area.toLocaleString()} m²</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-8 h-8 text-green-600" />
            <span className="text-sm font-medium text-green-700">Kupci</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total_customers}</p>
          <p className="text-sm text-gray-600 mt-1">Aktivnih kupaca</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="w-8 h-8 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">Investirano</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">€{stats.total_invested.toLocaleString()}</p>
          <p className="text-sm text-gray-600 mt-1">Kupovina zemljišta</p>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-6 border border-teal-200">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">Prihod</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">€{stats.total_revenue.toLocaleString()}</p>
          <p className="text-sm text-gray-600 mt-1">Ukupne prodaje</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Naplata</h3>
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Plaćeno:</span>
              <span className="font-semibold text-green-600">€{stats.total_paid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Za naplatu:</span>
              <span className="font-semibold text-orange-600">€{stats.total_remaining.toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t flex justify-between">
              <span className="text-sm font-medium text-gray-700">Ukupno:</span>
              <span className="font-bold text-gray-900">€{stats.total_revenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Profit</h3>
            <TrendingUp className={`w-6 h-6 ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Naplata:</span>
              <span className="font-semibold text-green-600">€{stats.total_paid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Troškovi:</span>
              <span className="font-semibold text-red-600">€{stats.total_invested.toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t flex justify-between">
              <span className="text-sm font-medium text-gray-700">Profit:</span>
              <span className={`font-bold text-lg ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.profit >= 0 ? '+' : ''}€{stats.profit.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Prosječno</h3>
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Cijena/m²:</span>
              <span className="font-semibold text-gray-900">
                €{stats.total_area > 0 ? (stats.total_invested / stats.total_area).toFixed(2) : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Po parceli:</span>
              <span className="font-semibold text-gray-900">
                €{stats.total_plots > 0 ? (stats.total_invested / stats.total_plots).toLocaleString() : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Po kupcu:</span>
              <span className="font-semibold text-gray-900">
                €{stats.total_customers > 0 ? (stats.total_revenue / stats.total_customers).toLocaleString() : 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start space-x-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Kašnjenja u plaćanju ({overdueInvoices.length})
              </h3>
              <div className="space-y-2">
                {overdueInvoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="bg-white rounded-lg p-4 border border-red-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{invoice.customer_name}</p>
                        <p className="text-sm text-gray-600">
                          {invoice.invoice_number} • Ugovor {invoice.contract_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          Rok: {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Kasni {invoice.days_overdue} {invoice.days_overdue === 1 ? 'dan' : 'dana'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">€{invoice.remaining_amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">za naplatu</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {overdueInvoices.length > 5 && (
                <p className="text-sm text-red-700 mt-3">
                  + još {overdueInvoices.length - 5} kašnjenja
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RetailDashboard
