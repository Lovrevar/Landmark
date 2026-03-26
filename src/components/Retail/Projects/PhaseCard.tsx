import React, { useState } from 'react'
import { Plus, Edit2, Trash2, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Button, Badge, EmptyState } from '../../ui'
import type { RetailProjectPhase, RetailContract, RetailProjectWithPhases } from '../../../types/retail'

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
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  const contractsWithContract = phaseContracts.filter(c => c.has_contract && c.contract_amount > 0)
  const contractsWithoutContract = phaseContracts.filter(c => !c.has_contract || c.contract_amount === 0)

  const totalContractCost = contractsWithContract.reduce((sum, c) => sum + c.contract_amount, 0)
  const totalPaidWithContract = contractsWithContract.reduce((sum, c) => sum + (c.invoice_total_paid || 0), 0)
  const totalPaidWithoutContract = contractsWithoutContract.reduce((sum, c) => sum + (c.invoice_total_paid || 0), 0)
  const totalPaidOut = totalPaidWithContract + totalPaidWithoutContract

  const totalUnpaidWithContract = contractsWithContract.reduce((sum, c) => {
    const paid = c.invoice_total_paid || 0
    return sum + Math.max(0, c.contract_amount - paid)
  }, 0)
  const totalUnpaidWithoutContract = contractsWithoutContract.reduce((sum, c) => sum + (c.invoiced_remaining || 0), 0)
  const totalUnpaid = totalUnpaidWithContract + totalUnpaidWithoutContract

  const availableBudget = phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract
  const budgetUtilization = phase.budget_allocated > 0 ? (totalPaidOut / phase.budget_allocated) * 100 : 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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
              title={isExpanded ? t('retail_projects.collapse_phase') : t('retail_projects.expand_phase')}
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
              <p className="text-gray-600">{t('retail_projects.phase_order', { order: phase.phase_order })} • {t('retail_projects.contracts_count', { count: phaseContracts.length })}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {phase.phase_type !== 'sales' && (
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(phase.budget_allocated)}</p>
                <p className="text-sm text-gray-600">{t('retail_projects.forecasted_budget')}</p>
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
              {phase.phase_type === 'development' ? t('retail_projects.add_supplier_btn') :
               phase.phase_type === 'construction' ? t('retail_projects.add_contract_btn') :
               t('retail_projects.add_sale_btn')}
            </Button>
          </div>
        </div>

        <div className={`mt-4 grid grid-cols-1 gap-4 ${phase.phase_type === 'sales' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700">{phase.phase_type === 'sales' ? t('retail_projects.sales_revenue_label') : t('retail_projects.contracted_amount')}</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalContractCost)}</p>
          </div>
          <div className="bg-teal-50 p-3 rounded-lg">
            <p className="text-sm text-teal-700">{phase.phase_type === 'sales' ? t('retail_projects.received') : t('retail_projects.paid_out')}</p>
            <p className="text-lg font-bold text-teal-900">{formatCurrency(totalPaidOut)}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-sm text-orange-700">{phase.phase_type === 'sales' ? t('retail_projects.outstanding') : t('retail_projects.unpaid_contracts')}</p>
            <p className="text-lg font-bold text-orange-900">{formatCurrency(totalUnpaid)}</p>
          </div>
          {phase.phase_type !== 'sales' && (
            <div className={`p-3 rounded-lg ${availableBudget < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-sm ${availableBudget < 0 ? 'text-red-700' : 'text-green-700'}`}>
                {t('retail_projects.forecasted_budget')}
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
              <span className="text-sm text-gray-600">{t('retail_projects.budget_utilization')}</span>
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
                {t('retail_projects.over_budget_by', { amount: formatCurrency(totalPaidOut - phase.budget_allocated) })}
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
            title={t('retail_projects.no_contracts_phase')}
            action={
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => onAddContract(phase)}
              >
                {t('retail_projects.add_first_contract')}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {phaseContracts.map((contract) => {
              const hasValidContract = contract.has_contract && contract.contract_amount > 0
              const actualPaid = contract.invoice_total_paid || 0
              const contractAmount = contract.contract_amount || 0
              const remainingToPay = hasValidContract ? Math.max(0, contractAmount - actualPaid) : 0
              const gainLoss = hasValidContract ? actualPaid - contractAmount : 0
              const isPaid = hasValidContract && actualPaid >= contractAmount
              const isPartial = actualPaid > 0 && actualPaid < contractAmount

              const getContractBadgeVariant = (): 'red' | 'green' | 'blue' | 'gray' | 'yellow' => {
                if (!hasValidContract) return 'yellow'
                if (gainLoss > 0) return 'red'
                if (isPaid && gainLoss === 0) return 'green'
                if (isPartial) return 'blue'
                return 'gray'
              }

              const getContractStatusLabel = () => {
                if (gainLoss > 0) return t('retail_projects.overpaid')
                if (isPaid && gainLoss === 0) return t('retail_projects.milestones.status_paid')
                if (isPartial) return t('retail_projects.milestones.status_pending')
                return t('retail_projects.milestones.status_unpaid')
              }

              return (
                <div
                  key={contract.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                    !hasValidContract ? 'border-yellow-200 bg-yellow-50' :
                    gainLoss > 0 ? 'border-red-200 bg-red-50' :
                    isPaid && gainLoss === 0 ? 'border-green-200 bg-green-50' :
                    isPartial ? 'border-blue-200 bg-blue-50' :
                    'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {phase.phase_type === 'sales'
                            ? (contract.customer?.name || t('retail_projects.unknown_customer'))
                            : (contract.supplier?.name || t('retail_projects.unknown_supplier'))
                          }
                        </h4>
                        {!hasValidContract && (
                          <Badge variant="yellow" size="sm">
                            {t('retail_projects.no_contract_badge')}
                          </Badge>
                        )}
                      </div>
                      {phase.phase_type !== 'sales' && contract.supplier?.supplier_type?.name && (
                        <p className="text-sm text-gray-600 mb-1">{contract.supplier.supplier_type.name}</p>
                      )}
                      <p className="text-xs text-gray-500">{contract.contract_number}</p>
                    </div>
                    {hasValidContract && (
                      <Badge variant={getContractBadgeVariant()} size="sm">
                        {getContractStatusLabel()}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-xs mb-3">
                    {contract.contract_date && phase.phase_type !== 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">{t('retail_projects.contract_date_label')}</span>
                        <span className="font-medium text-gray-900">
                          {format(new Date(contract.contract_date), 'dd.MM.yyyy')}
                        </span>
                      </div>
                    )}
                    {contract.notes && (phase.phase_type === 'development' || phase.phase_type === 'construction') && (
                      <div className="mb-2">
                        <span className="text-gray-600">{t('retail_projects.description_label')}</span>
                        <p className="text-gray-700 mt-1 text-xs line-clamp-2">{contract.notes}</p>
                      </div>
                    )}
                    {contract.building_surface_m2 && phase.phase_type === 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">{t('retail_projects.building_surface_label')}</span>
                        <span className="font-medium text-blue-600">{contract.building_surface_m2.toLocaleString('hr-HR')} m²</span>
                      </div>
                    )}
                    {contract.total_surface_m2 && phase.phase_type === 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">{t('retail_projects.total_surface_label')}</span>
                        <span className="font-medium text-blue-600">{contract.total_surface_m2.toLocaleString('hr-HR')} m²</span>
                      </div>
                    )}
                    {contract.price_per_m2 && phase.phase_type === 'sales' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">{t('retail_projects.price_per_m2_label_col')}</span>
                        <span className="font-medium text-teal-600">
                          {formatCurrency(contract.price_per_m2)}
                        </span>
                      </div>
                    )}
                    {contract.end_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">{t('retail_projects.deadline_label')}</span>
                        <span className="font-medium text-gray-900">
                          {format(new Date(contract.end_date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    )}
                    {hasValidContract ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">{t('retail_projects.contract_value_label')}</span>
                          <span className="font-medium text-gray-900">{formatCurrency(contractAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">{t('retail_projects.paid_label')}</span>
                          <span className="font-medium text-teal-600">{formatCurrency(actualPaid)}</span>
                        </div>
                        {remainingToPay > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">{t('retail_projects.remaining_label')}</span>
                            <span className="font-medium text-orange-600">{formatCurrency(remainingToPay)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">{t('retail_projects.gain_loss_label')}</span>
                          <span className={`font-bold ${
                            gainLoss > 0 ? 'text-red-600' :
                            gainLoss < 0 ? 'text-green-600' :
                            'text-gray-900'
                          }`}>
                            {gainLoss > 0 ? '-' : gainLoss < 0 ? '+' : ''}{formatCurrency(Math.abs(gainLoss))}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">{t('retail_projects.total_paid_label')}</span>
                          <span className="font-bold text-green-600">{formatCurrency(actualPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 font-medium">{t('retail_projects.total_debts_label')}</span>
                          <span className="font-bold text-orange-600">{formatCurrency(contract.invoiced_remaining || 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => onViewPayments(contract)}
                    >
                      {t('common.payments')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => onViewInvoices(contract)}
                    >
                      {t('common.invoices')}
                    </Button>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => onEditContract(contract)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="amber"
                        size="sm"
                        fullWidth
                        onClick={() => onManageMilestones(contract, phase, project)}
                      >
                        📊
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        fullWidth
                        onClick={() => onDeleteContract(contract.id)}
                      >
                        {t('common.delete')}
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
