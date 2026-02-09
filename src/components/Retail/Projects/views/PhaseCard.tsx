import React, { useState } from 'react'
import { Building2, Plus, Edit2, Trash2, DollarSign, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { Button, Badge, EmptyState } from '../../../../components/ui'
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
  const [isExpanded, setIsExpanded] = useState(false)

  const totalContractCost = phaseContracts.reduce((sum, contract) => sum + contract.contract_amount, 0)
  const totalBudgetRealized = phaseContracts.reduce((sum, contract) => sum + contract.budget_realized, 0)
  const unpaidContracts = phaseContracts.reduce((sum, contract) => sum + (contract.invoiced_remaining || 0), 0)
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
      case 'development':
        return '📐'
      case 'construction':
        return '🏗️'
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
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-3 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors duration-200"
              title={isExpanded ? "Collapse phase" : "Expand phase"}
            >
              {isExpanded ? (
                <ChevronUp className="w-6 h-6 text-blue-600" />
              ) : (
                <ChevronDown className="w-6 h-6 text-blue-600" />
              )}
            </button>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                <span className="mr-2">{getPhaseIcon(phase.phase_type)}</span>
                {phase.phase_name}
              </h3>
              <p className="text-gray-600">Phase {phase.phase_order} • {phaseContracts.length} contract{phaseContracts.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {phase.phase_type !== 'sales' && (
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(phase.budget_allocated)}</p>
                <p className="text-sm text-gray-600">Allocated Budget</p>
              </div>
            )}
            <Button
              variant="ghost"
              icon={Edit2}
              size="icon-md"
              onClick={() => onEditPhase(phase)}
            />
            <Button
              variant="outline-danger"
              icon={Trash2}
              size="icon-md"
              onClick={() => onDeletePhase(phase)}
            />
            <Button
              variant="success"
              icon={Plus}
              onClick={() => onAddContract(phase)}
            >
              {phase.phase_type === 'development' ? 'Add Supplier' :
               phase.phase_type === 'construction' ? 'Add Contract' :
               'Add Sale'}
            </Button>
          </div>
        </div>

        <div className={`mt-4 grid grid-cols-1 gap-4 ${phase.phase_type === 'sales' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700">{phase.phase_type === 'sales' ? 'Sales Revenue' : 'Contract Cost'}</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalContractCost)}</p>
          </div>
          <div className="bg-teal-50 p-3 rounded-lg">
            <p className="text-sm text-teal-700">{phase.phase_type === 'sales' ? 'Received' : 'Paid Out'}</p>
            <p className="text-lg font-bold text-teal-900">{formatCurrency(totalBudgetRealized)}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-sm text-orange-700">{phase.phase_type === 'sales' ? 'Outstanding' : 'Unpaid Contracts'}</p>
            <p className="text-lg font-bold text-orange-900">{formatCurrency(unpaidContracts)}</p>
          </div>
          {phase.phase_type !== 'sales' && (
            <div className={`p-3 rounded-lg ${availableBudget < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-sm ${availableBudget < 0 ? 'text-red-700' : 'text-green-700'}`}>
                Available Budget
              </p>
              <p className={`text-lg font-bold ${availableBudget < 0 ? 'text-red-900' : 'text-green-900'}`}>
                {formatCurrency(availableBudget)}
              </p>
            </div>
          )}
        </div>

        {phase.phase_type !== 'sales' && (
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
        )}
      </div>

      {isExpanded && (
        <div className="p-6">
          {phaseContracts.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No contracts in this phase yet"
            action={
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => onAddContract(phase)}
              >
                Add First Contract
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {phaseContracts.map((contract) => {
              const remainingToPay = Math.max(0, contract.contract_amount - contract.budget_realized)
              const isPaid = contract.budget_realized >= contract.contract_amount
              const isPartial = contract.budget_realized > 0 && contract.budget_realized < contract.contract_amount
              const gainLoss = contract.budget_realized - contract.contract_amount

              const getContractBadgeVariant = (): 'red' | 'green' | 'blue' | 'gray' => {
                if (gainLoss > 0) return 'red'
                if (isPaid && gainLoss === 0) return 'green'
                if (isPartial) return 'blue'
                return 'gray'
              }

              const getContractStatusLabel = () => {
                if (gainLoss > 0) return 'Overpaid'
                if (isPaid && gainLoss === 0) return 'Paid'
                if (isPartial) return 'Partial'
                return 'Unpaid'
              }

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
                        {phase.phase_type === 'sales'
                          ? (contract.customer?.name || 'Unknown Customer')
                          : (contract.supplier?.name || 'Unknown Supplier')
                        }
                      </h4>
                      {phase.phase_type !== 'sales' && contract.supplier?.supplier_type && (
                        <p className="text-sm text-gray-600 mb-1">{contract.supplier.supplier_type}</p>
                      )}
                      <p className="text-xs text-gray-500">{contract.contract_number}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {contract.has_contract === false && (
                        <Badge variant="yellow" size="sm">
                          BEZ UGOVORA
                        </Badge>
                      )}
                      <Badge variant={getContractBadgeVariant()}>
                        {getContractStatusLabel()}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs mb-3">
                    {contract.contract_date && phase.phase_type !== 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Datum ugovora:</span>
                        <span className="font-medium text-gray-900">
                          {format(new Date(contract.contract_date), 'dd.MM.yyyy')}
                        </span>
                      </div>
                    )}
                    {contract.notes && (phase.phase_type === 'development' || phase.phase_type === 'construction') && (
                      <div className="mb-2">
                        <span className="text-gray-600">Opis:</span>
                        <p className="text-gray-700 mt-1 text-xs line-clamp-2">{contract.notes}</p>
                      </div>
                    )}
                    {contract.building_surface_m2 && phase.phase_type === 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Površina objekta:</span>
                        <span className="font-medium text-blue-600">{contract.building_surface_m2.toLocaleString('hr-HR')} m²</span>
                      </div>
                    )}
                    {contract.total_surface_m2 && phase.phase_type === 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Površina ukupno:</span>
                        <span className="font-medium text-blue-600">{contract.total_surface_m2.toLocaleString('hr-HR')} m²</span>
                      </div>
                    )}
                    {contract.price_per_m2 && phase.phase_type === 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Cijena po m²:</span>
                        <span className="font-medium text-teal-600">
                          {formatCurrency(contract.price_per_m2)}
                        </span>
                      </div>
                    )}
                    {contract.end_date && (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="bg-teal-600 text-white hover:bg-teal-700"
                      onClick={() => onViewPayments(contract)}
                    >
                      View Payments
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => onViewInvoices(contract)}
                    >
                      View Invoices
                    </Button>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        onClick={() => onEditContract(contract)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="amber"
                        size="sm"
                        onClick={() => onManageMilestones(contract, phase, project)}
                      >
                        📊
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onDeleteContract(contract.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>
      )}
    </div>
  )
}
