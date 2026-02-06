import React from 'react'
import { CreditCard, Plus, Calendar, Percent, DollarSign, Clock, Edit, Trash2 } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useCredits } from './hooks/useCredits'
import CreditFormModal from './forms/CreditFormModal'
import type { Credit } from './types/creditTypes'

const CompanyCredits: React.FC = () => {
  const {
    credits,
    companies,
    projects,
    loading,
    showModal,
    editingCredit,
    formData,
    setFormData,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete
  } = useCredits()

  const getUtilizationPercentage = (credit: Credit) => {
    if (credit.amount === 0) return 0
    const usedAmount = credit.used_amount || 0
    return (usedAmount / credit.amount) * 100
  }

  const isExpiringSoon = (endDate: string) => {
    const daysUntilExpiry = differenceInDays(new Date(endDate), new Date())
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90
  }

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company Credits</h2>
          <p className="text-gray-600 mt-1">Manage company credit lines and loans</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credit</span>
        </button>
      </div>

      <div className="grid gap-6">
        {credits.map((credit) => {
          const utilizationPercent = getUtilizationPercentage(credit)
          const expiringSoon = isExpiringSoon(credit.maturity_date)
          const expired = isExpired(credit.maturity_date)
          const usedAmount = credit.used_amount || 0
          const remaining = credit.amount - usedAmount

          return (
            <div key={credit.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-bold text-gray-900">{credit.credit_name}</h3>
                    {credit.project && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {credit.project.name}
                      </span>
                    )}
                    {expired && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                        EXPIRED
                      </span>
                    )}
                    {!expired && expiringSoon && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                        EXPIRING SOON
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    {credit.company.name} ({credit.company.oib})
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal(credit)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(credit.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-gray-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Credit Limit</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-blue-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Used</span>
                  </div>
                  <p className="text-xl font-bold text-blue-900">€{usedAmount.toLocaleString('hr-HR')}</p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-purple-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Repaid</span>
                  </div>
                  <p className="text-xl font-bold text-purple-900">€{(credit.repaid_amount || 0).toLocaleString('hr-HR')}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-green-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Available</span>
                  </div>
                  <p className="text-xl font-bold text-green-900">€{remaining.toLocaleString('hr-HR')}</p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-orange-600 mb-1">
                    <Percent className="w-4 h-4" />
                    <span className="text-sm">Interest Rate</span>
                  </div>
                  <p className="text-xl font-bold text-orange-900">{credit.interest_rate}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Start Date:</span>
                  </span>
                  <p className="font-medium text-gray-900">{format(new Date(credit.start_date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Maturity Date:</span>
                  </span>
                  <p className="font-medium text-gray-900">{format(new Date(credit.maturity_date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Grace Period:</span>
                  </span>
                  <p className="font-medium text-gray-900">{Math.round(credit.grace_period / 30)} months</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Utilization</span>
                  <span className="font-semibold text-gray-900">{utilizationPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      utilizationPercent >= 90 ? 'bg-red-500' :
                      utilizationPercent >= 70 ? 'bg-orange-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}

        {credits.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Credits Yet</h3>
            <p className="text-gray-600 mb-4">Add your first credit line to start tracking credit utilization</p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Credit</span>
            </button>
          </div>
        )}
      </div>

      <CreditFormModal
        showModal={showModal}
        editingCredit={editingCredit}
        formData={formData}
        setFormData={setFormData}
        companies={companies}
        projects={projects}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
      />
    </div>
  )
}

export default CompanyCredits
