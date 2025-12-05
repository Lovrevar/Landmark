import React from 'react'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Building2, MapPin } from 'lucide-react'
import type { RetailProjectWithPhases, RetailContract } from '../../../../types/retail'

interface ProjectStatisticsProps {
  project: RetailProjectWithPhases
  allContracts: RetailContract[]
}

export const ProjectStatistics: React.FC<ProjectStatisticsProps> = ({ project, allContracts }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const developmentPhases = project.phases.filter(p => p.phase_type === 'development')
  const constructionPhases = project.phases.filter(p => p.phase_type === 'construction')
  const salesPhases = project.phases.filter(p => p.phase_type === 'sales')

  const developmentContracts = allContracts.filter(c =>
    developmentPhases.some(p => p.id === c.phase_id)
  )
  const constructionContracts = allContracts.filter(c =>
    constructionPhases.some(p => p.id === c.phase_id)
  )
  const salesContracts = allContracts.filter(c =>
    salesPhases.some(p => p.id === c.phase_id)
  )

  const landCost = project.land_plot?.total_price || 0
  const developmentCost = developmentContracts.reduce((sum, c) => sum + c.budget_realized, 0)
  const constructionCost = constructionContracts.reduce((sum, c) => sum + c.budget_realized, 0)
  const totalExpenses = landCost + developmentCost + constructionCost

  const salesRevenue = salesContracts.reduce((sum, c) => sum + c.budget_realized, 0)
  const totalRevenue = salesRevenue

  const profitLoss = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (profitLoss / totalRevenue) * 100 : 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Financijska Statistika</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-gray-900">Rashodi</h4>
          </div>

          <div className="space-y-3 pl-7">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-700">Cijena Zemljišta</span>
              </div>
              <span className="font-semibold text-red-700">{formatCurrency(landCost)}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-700">Razvoj</span>
              </div>
              <span className="font-semibold text-red-700">{formatCurrency(developmentCost)}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-700">Gradnja</span>
              </div>
              <span className="font-semibold text-red-700">{formatCurrency(constructionCost)}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-100 rounded-lg border-2 border-red-200 mt-2">
              <span className="font-semibold text-gray-900">Ukupni Rashodi</span>
              <span className="text-lg font-bold text-red-700">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-gray-900">Prihodi</h4>
          </div>

          <div className="space-y-3 pl-7">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Prodaja</span>
              </div>
              <span className="font-semibold text-green-700">{formatCurrency(salesRevenue)}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-100 rounded-lg border-2 border-green-200 mt-2">
              <span className="font-semibold text-gray-900">Ukupni Prihodi</span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className={`p-6 rounded-xl ${profitLoss >= 0 ? 'bg-gradient-to-r from-green-50 to-green-100' : 'bg-gradient-to-r from-red-50 to-red-100'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">
                {profitLoss >= 0 ? 'Profit' : 'Gubitak'}
              </h4>
              <p className={`text-3xl font-bold ${profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(profitLoss))}
              </p>
              {totalRevenue > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  Marža: {profitMargin.toFixed(2)}%
                </p>
              )}
            </div>
            <div className={`p-4 rounded-full ${profitLoss >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
              {profitLoss >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-700" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-700" />
              )}
            </div>
          </div>
        </div>
      </div>

      {!project.land_plot && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Projekt nije povezan sa zemljištem. Povežite projekt sa zemljištem da bi se prikazala stvarna cijena zemljišta u rashodima.
          </p>
        </div>
      )}

      {totalRevenue === 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Nema zabilježenih prihoda. Dodajte ugovore u Sales fazu da bi se prikazali prihodi.
          </p>
        </div>
      )}
    </div>
  )
}
