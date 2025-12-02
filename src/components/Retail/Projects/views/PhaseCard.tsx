import React from 'react'
import { Building2, Plus, Edit2, Trash2, DollarSign, Calendar } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import type { RetailProjectPhase, RetailContract, RetailProjectWithPhases } from '../../../../types/retail'

interface PhaseCardProps {
  phase: RetailProjectPhase
  project: RetailProjectWithPhases
  phaseContracts: RetailContract[]
  onEditPhase: (phase: RetailProjectPhase) => void
  onDeletePhase: (phase: RetailProjectPhase) => void
  onAddContract: (phase: RetailProjectPhase) => void
  onEditContract: (contract: RetailContract) => void
  onDeleteContract: (contractId: string) => void
  onViewPayments: (contract: RetailContract) => void
  onViewInvoices: (contract: RetailContract) => void
  onManageMilestones: (contract: RetailContract, phase: RetailProjectPhase, project: RetailProjectWithPhases) => void
}

export const PhaseCard: React.FC<PhaseCardProps> = ({
  phase,
  project,
  phaseContracts,
  onEditPhase,
  onDeletePhase,
  onAddContract,
  onEditContract,
  onDeleteContract,
  onViewPayments,
  onViewInvoices,
  onManageMilestones
}) => {
  const totalContractCost = phaseContracts.reduce((sum, contract) => sum + contract.contract_amount, 0)
  const totalBudgetRealized = phaseContracts.reduce((sum, contract) => sum + contract.budget_realized, 0)
  const unpaidContracts = totalContractCost - totalBudgetRealized
  const availableBudget = phase.budget_allocated - totalContractCost
  const budgetUtilization = phase.budget_allocated > 0 ? (totalBudgetRealized / phase.budget_allocated) * 100 : 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getPhaseIcon = (type: string) => {
    switch (type) {
      case 'acquisition':
        return '🏗️'
      case 'development':
        return '📐'
      case 'sales':
        return '💰'
      default:
        return '📋'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-4xl">{getPhaseIcon(phase.phase_type)}</div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{phase.phase_name}</h3>
              <p className="text-gray-600">Phase {phase.phase_order}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(phase.budget_allocated)}</p>
              <p className="text-sm text-gray-600">Allocated Budget</p>
            </div>
            <button
              onClick={() => onEditPhase(phase)}
              className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
              title="Edit phase"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeletePhase(phase)}
              className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
              title="Delete phase"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAddContract(phase)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              {phase.phase_type === 'acquisition' ? 'Add Acquisition' :
               phase.phase_type === 'development' ? 'Add Supplier' :
               'Add Sale'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700">Contract Cost</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalContractCost)}</p>
          </div>
          <div className="bg-teal-50 p-3 rounded-lg">
            <p className="text-sm text-teal-700">Paid Out</p>
            <p className="text-lg font-bold text-teal-900">{formatCurrency(totalBudgetRealized)}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-sm text-orange-700">Unpaid Contracts</p>
            <p className="text-lg font-bold text-orange-900">{formatCurrency(unpaidContracts)}</p>
          </div>
          <div className={`p-3 rounded-lg ${availableBudget < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className={`text-sm ${availableBudget < 0 ? 'text-red-700' : 'text-green-700'}`}>
              Available Budget
            </p>
            <p className={`text-lg font-bold ${availableBudget < 0 ? 'text-red-900' : 'text-green-900'}`}>
              {formatCurrency(availableBudget)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Budget Utilization (Realized vs Allocated)</span>
            <span className="text-sm font-medium">{budgetUtilization.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                budgetUtilization > 100 ? 'bg-red-600' :
                budgetUtilization > 80 ? 'bg-orange-600' :
                'bg-teal-600'
              }`}
              style={{ width: `${Math.min(100, budgetUtilization)}%` }}
            ></div>
          </div>
          {budgetUtilization > 100 && (
            <p className="text-xs text-red-600 mt-1">
              Over budget by {formatCurrency(totalBudgetRealized - phase.budget_allocated)}
            </p>
          )}
        </div>
      </div>

      <div className="p-6">
        {phaseContracts.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No contracts in this phase yet</p>
            <button
              onClick={() => onAddContract(phase)}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Add First Contract
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {phaseContracts.map((contract) => {
              const remainingToPay = Math.max(0, contract.contract_amount - contract.budget_realized)
              const isPaid = contract.budget_realized >= contract.contract_amount
              const isPartial = contract.budget_realized > 0 && contract.budget_realized < contract.contract_amount
              const gainLoss = contract.budget_realized - contract.contract_amount

              return (
                <div
                  key={contract.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                    gainLoss > 0 ? 'border-red-200 bg-red-50' :
                    isPaid && gainLoss === 0 ? 'border-green-200 bg-green-50' :
                    isPartial ? 'border-blue-200 bg-blue-50' :
                    'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {contract.supplier?.name || 'Unknown Supplier'}
                      </h4>
                      <p className="text-sm text-gray-600 mb-1">{contract.supplier?.supplier_type}</p>
                      <p className="text-xs text-gray-500">{contract.contract_number}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                      gainLoss > 0 ? 'bg-red-100 text-red-800' :
                      isPaid && gainLoss === 0 ? 'bg-green-100 text-green-800' :
                      isPartial ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {gainLoss > 0 ? 'Overpaid' :
                       isPaid && gainLoss === 0 ? 'Paid' :
                       isPartial ? 'Partial' : 'Unpaid'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs mb-3">
                    {contract.contract_date && phase.phase_type === 'acquisition' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Datum ugovora:</span>
                        <span className="font-medium text-gray-900">
                          {format(new Date(contract.contract_date), 'dd.MM.yyyy')}
                        </span>
                      </div>
                    )}
                    {contract.land_area_m2 && phase.phase_type === 'acquisition' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Površina:</span>
                        <span className="font-medium text-blue-600">{contract.land_area_m2.toLocaleString()} m²</span>
                      </div>
                    )}
                    {contract.land_area_m2 && contract.contract_amount && phase.phase_type === 'acquisition' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Cijena po m²:</span>
                        <span className="font-medium text-purple-600">
                          {formatCurrency(contract.contract_amount / contract.land_area_m2)}
                        </span>
                      </div>
                    )}
                    {contract.end_date && phase.phase_type !== 'acquisition' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Deadline:</span>
                        <span className="font-medium text-gray-900">
                          {format(new Date(contract.end_date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Contract:</span>
                      <span className="font-medium text-gray-900">{formatCurrency(contract.contract_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Paid:</span>
                      <span className="font-medium text-teal-600">{formatCurrency(contract.budget_realized)}</span>
                    </div>
                    {remainingToPay > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Remaining:</span>
                        <span className="font-medium text-orange-600">{formatCurrency(remainingToPay)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-600 font-medium">Gain/Loss:</span>
                      <span className={`font-bold ${
                        gainLoss > 0 ? 'text-red-600' :
                        gainLoss < 0 ? 'text-green-600' :
                        'text-gray-900'
                      }`}>
                        {gainLoss > 0 ? '-' : gainLoss < 0 ? '+' : ''}{formatCurrency(Math.abs(gainLoss))}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => onViewPayments(contract)}
                      className="w-full px-3 py-2 bg-teal-600 text-white rounded-md text-xs font-medium hover:bg-teal-700 transition-colors"
                    >
                      View Payments
                    </button>
                    <button
                      onClick={() => onViewInvoices(contract)}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-colors"
                    >
                      View Invoices
                    </button>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => onEditContract(contract)}
                        className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onManageMilestones(contract, phase, project)}
                        className="px-2 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors"
                        title="Milestones"
                      >
                        📊
                      </button>
                      <button
                        onClick={() => onDeleteContract(contract.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
