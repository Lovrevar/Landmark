import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { BarChart3, MapPin, Users, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface DashboardStats {
  total_plots: number
  total_area: number
  total_invested: number
  total_customers: number
  total_revenue: number
  total_paid: number
  total_remaining: number
  profit: number
}

interface OverdueSale {
  id: string
  customer_name: string
  plot_number: string
  remaining_amount: number
  payment_deadline: string
  days_overdue: number
}

const RetailDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    total_plots: 0,
    total_area: 0,
    total_invested: 0,
    total_customers: 0,
    total_revenue: 0,
    total_paid: 0,
    total_remaining: 0,
    profit: 0
  })
  const [overdueSales, setOverdueSales] = useState<OverdueSale[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const [plotsRes, customersRes, salesRes] = await Promise.all([
        supabase.from('retail_land_plots').select('*'),
        supabase.from('retail_customers').select('*'),
        supabase
          .from('retail_sales')
          .select(`
            *,
            customer:retail_customers(name),
            land_plot:retail_land_plots(plot_number)
          `)
      ])

      const plots = plotsRes.data || []
      const customers = customersRes.data || []
      const sales = salesRes.data || []

      const total_invested = plots.reduce((sum, p) => sum + p.total_price, 0)
      const total_revenue = sales.reduce((sum, s) => sum + s.total_sale_price, 0)
      const total_paid = sales.reduce((sum, s) => sum + s.paid_amount, 0)
      const total_remaining = sales.reduce((sum, s) => sum + s.remaining_amount, 0)

      const today = new Date()
      const overdue = sales
        .filter(s => s.payment_status !== 'paid' && new Date(s.payment_deadline) < today)
        .map(s => ({
          id: s.id,
          customer_name: (s.customer as any)?.name || 'N/A',
          plot_number: (s.land_plot as any)?.plot_number || 'N/A',
          remaining_amount: s.remaining_amount,
          payment_deadline: s.payment_deadline,
          days_overdue: Math.floor((today.getTime() - new Date(s.payment_deadline).getTime()) / (1000 * 60 * 60 * 24))
        }))
        .sort((a, b) => b.days_overdue - a.days_overdue)

      setStats({
        total_plots: plots.length,
        total_area: plots.reduce((sum, p) => sum + p.purchased_area_m2, 0),
        total_invested,
        total_customers: customers.length,
        total_revenue,
        total_paid,
        total_remaining,
        profit: total_paid - total_invested
      })

      setOverdueSales(overdue)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje...</p>
        </div>
      </div>
    )
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

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Prihod</span>
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

      {overdueSales.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start space-x-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Kašnjenja u plaćanju ({overdueSales.length})
              </h3>
              <div className="space-y-2">
                {overdueSales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="bg-white rounded-lg p-4 border border-red-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{sale.customer_name}</p>
                        <p className="text-sm text-gray-600">
                          Čestica {sale.plot_number} • Rok: {format(new Date(sale.payment_deadline), 'dd.MM.yyyy')}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Kasni {sale.days_overdue} {sale.days_overdue === 1 ? 'dan' : 'dana'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">€{sale.remaining_amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">za naplatu</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {overdueSales.length > 5 && (
                <p className="text-sm text-red-700 mt-3">
                  + još {overdueSales.length - 5} kašnjenja
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
