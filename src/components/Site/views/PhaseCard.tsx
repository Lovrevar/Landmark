import React, { useState } from 'react'
import { Building2, Plus, Edit2, Trash2, DollarSign, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases } from '../types/siteTypes'

interface PhaseCardProps {
  phase: ProjectPhase
  project: ProjectWithPhases
  phaseSubcontractors: Subcontractor[]
  onEditPhase: (phase: ProjectPhase) => void
  onDeletePhase: (phase: ProjectPhase) => void
  onAddSubcontractor: (phase: ProjectPhase) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
}

export const PhaseCard: React.FC<PhaseCardProps> = ({
  phase,
  project,
  phaseSubcontractors,
  onEditPhase,
  onDeletePhase,
  onAddSubcontractor,
  onOpenPaymentHistory,
  onOpenInvoices,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor,
  onManageMilestones
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedContractTypes, setExpandedContractTypes] = useState<Set<string>>(new Set())

  const toggleContractType = (typeKey: string) => {
    setExpandedContractTypes(prev => {
      const next = new Set(prev)
      if (next.has(typeKey)) {
        next.delete(typeKey)
      } else {
        next.add(typeKey)
      }
      return next
    })
  }

  const groupedSubcontractors = phaseSubcontractors.reduce((groups, sub) => {
    const typeKey = sub.contract_type_name || 'Uncategorized'
    if (!groups[typeKey]) {
      groups[typeKey] = []
    }
    groups[typeKey].push(sub)
    return groups
  }, {} as Record<string, typeof phaseSubcontractors>)

  const sortedContractTypeKeys = Object.keys(groupedSubcontractors).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  const subcontractorsWithContract = phaseSubcontractors.filter(sub => sub.has_contract !== false && sub.cost > 0)
  const subcontractorsWithoutContract = phaseSubcontractors.filter(sub => sub.has_contract === false || sub.cost === 0)

  const totalContractCost = subcontractorsWithContract.reduce((sum, sub) => sum + sub.cost, 0)

  const totalPaidWithContract = subcontractorsWithContract.reduce((sum, sub) => sum + (sub.invoice_total_paid || 0), 0)
  const totalPaidWithoutContract = subcontractorsWithoutContract.reduce((sum, sub) => sum + (sub.invoice_total_paid || 0), 0)
  const totalPaidOut = totalPaidWithContract + totalPaidWithoutContract

  const totalUnpaidWithContract = subcontractorsWithContract.reduce((sum, sub) => {
    const paid = sub.invoice_total_paid || 0
    return sum + Math.max(0, sub.cost - paid)
  }, 0)
  const totalUnpaidWithoutContract = subcontractorsWithoutContract.reduce((sum, sub) => sum + (sub.invoice_total_owed || 0), 0)
  const totalUnpaid = totalUnpaidWithContract + totalUnpaidWithoutContract

  const budgetUtilization = phase.budget_allocated > 0 ? (totalPaidOut / phase.budget_allocated) * 100 : 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
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
              <h3 className="text-xl font-semibold text-gray-900">{phase.phase_name}</h3>
              <p className="text-gray-600">Phase {phase.phase_number} • {phaseSubcontractors.length} subcontractor{phaseSubcontractors.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">€{phase.budget_allocated.toLocaleString('hr-HR')}</p>
              <p className="text-sm text-gray-600">Allocated Budget</p>
            </div>
            <button
              onClick={() => onEditPhase(phase)}
              className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors duration-200"
              title="Edit phase"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeletePhase(phase)}
              className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors duration-200"
              title="Delete phase"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAddSubcontractor(phase)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Subcontractor
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700">Contract Cost</p>
            <p className="text-lg font-bold text-gray-900">€{totalContractCost.toLocaleString('hr-HR')}</p>
          </div>
          <div className="bg-teal-50 p-3 rounded-lg">
            <p className="text-sm text-teal-700">Paid Out</p>
            <p className="text-lg font-bold text-teal-900">€{totalPaidOut.toLocaleString('hr-HR')}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-sm text-orange-700">Unpaid Contracts</p>
            <p className="text-lg font-bold text-orange-900">
              €{totalUnpaid.toLocaleString('hr-HR')}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            (phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract) < 0 ? 'bg-red-50' : 'bg-green-50'
          }`}>
            <p className={`text-sm ${
              (phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract) < 0 ? 'text-red-700' : 'text-green-700'
            }`}>Available Budget</p>
            <p className={`text-lg font-bold ${
              (phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract) < 0 ? 'text-red-900' : 'text-green-900'
            }`}>
              €{(phase.budget_allocated - totalContractCost - totalUnpaidWithoutContract).toLocaleString('hr-HR')}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Budget Utilization (Paid vs Allocated)</span>
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
              Over budget by €{(totalPaidOut - phase.budget_allocated).toLocaleString('hr-HR')}
            </p>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {phaseSubcontractors.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No subcontractors assigned to this phase yet</p>
            <button
              onClick={() => onAddSubcontractor(phase)}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Add First Subcontractor
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedContractTypeKeys.map((contractTypeName) => {
              const subcontractors = groupedSubcontractors[contractTypeName]
              const isTypeExpanded = expandedContractTypes.has(contractTypeName)
              const totalCost = subcontractors.reduce((sum, sub) => sum + (sub.cost || 0), 0)
              const totalPaid = subcontractors.reduce((sum, sub) => sum + (sub.invoice_total_paid || 0), 0)

              return (
                <div key={contractTypeName} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleContractType(contractTypeName)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      {isTypeExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                      <span className="font-semibold text-gray-900">{contractTypeName}</span>
                      <span className="text-sm text-gray-600">({subcontractors.length})</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div>
                        <span className="text-gray-600">Cost: </span>
                        <span className="font-semibold text-gray-900">€{totalCost.toLocaleString('hr-HR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Paid: </span>
                        <span className="font-semibold text-teal-600">€{totalPaid.toLocaleString('hr-HR')}</span>
                      </div>
                    </div>
                  </button>

                  {isTypeExpanded && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subcontractors.map((subcontractor) => {
              const hasValidContract = subcontractor.has_contract !== false && subcontractor.cost > 0
              const actualPaid = subcontractor.invoice_total_paid || 0
              const isOverdue = subcontractor.deadline ? new Date(subcontractor.deadline) < new Date() && actualPaid < subcontractor.cost : false
              const daysUntilDeadline = subcontractor.deadline ? differenceInDays(new Date(subcontractor.deadline), new Date()) : 0
              const subVariance = hasValidContract ? actualPaid - subcontractor.cost : 0
              const isPaid = hasValidContract && actualPaid >= subcontractor.cost
              const remainingToPay = hasValidContract ? Math.max(0, subcontractor.cost - actualPaid) : 0

              return (
                <div key={subcontractor.id} className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                  !hasValidContract ? 'border-yellow-200 bg-yellow-50' :
                  subVariance > 0 ? 'border-red-200 bg-red-50' :
                  isPaid && subVariance === 0 ? 'border-green-200 bg-green-50' :
                  actualPaid > 0 ? 'border-blue-200 bg-blue-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{subcontractor.name}</h4>
                        {subcontractor.has_contract === false && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
                            BEZ UGOVORA
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{subcontractor.contact}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{subcontractor.job_description}</p>
                    </div>
                    {hasValidContract && (
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                        subVariance > 0 ? 'bg-red-100 text-red-800' :
                        isPaid && subVariance === 0 ? 'bg-green-100 text-green-800' :
                        actualPaid > 0 ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {subVariance > 0 ? 'Over Budget' :
                         isPaid && subVariance === 0 ? 'Paid' :
                         actualPaid > 0 ? 'Partial' : 'Unpaid'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs mb-3">
                    {subcontractor.deadline && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Deadline:</span>
                        <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {format(new Date(subcontractor.deadline), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    )}
                    {hasValidContract ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Contract:</span>
                          <span className="font-medium text-gray-900">€{subcontractor.cost.toLocaleString('hr-HR')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Paid:</span>
                          <span className="font-medium text-teal-600">€{actualPaid.toLocaleString('hr-HR')}</span>
                        </div>
                        {remainingToPay > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Remaining:</span>
                            <span className="font-medium text-orange-600">€{remainingToPay.toLocaleString('hr-HR')}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">Gain/Loss:</span>
                          <span className={`font-bold ${
                            subVariance > 0 ? 'text-red-600' :
                            subVariance < 0 ? 'text-green-600' :
                            'text-gray-900'
                          }`}>
                            {subVariance > 0 ? '-' : subVariance < 0 ? '+' : ''}€{Math.abs(subVariance).toLocaleString('hr-HR')}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">Plaćeno ukupno:</span>
                          <span className="font-bold text-green-600">€{(subcontractor.invoice_total_paid || 0).toLocaleString('hr-HR')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 font-medium">Ukupno dugovi:</span>
                          <span className="font-bold text-orange-600">€{(subcontractor.invoice_total_owed || 0).toLocaleString('hr-HR')}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    {onOpenPaymentHistory && (
                      <button
                        onClick={() => onOpenPaymentHistory(subcontractor)}
                        className="w-full px-3 py-2 bg-teal-600 text-white rounded-md text-xs font-medium hover:bg-teal-700 transition-colors duration-200 flex items-center justify-center"
                      >
                        View Payments
                      </button>
                    )}
                    {onOpenInvoices && (
                      <button
                        onClick={() => onOpenInvoices(subcontractor)}
                        className="w-full px-3 py-2 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-colors duration-200 flex items-center justify-center"
                      >
                        View Invoices
                      </button>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => onEditSubcontractor(subcontractor)}
                        className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors duration-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onOpenSubDetails(subcontractor)}
                        className="px-2 py-1 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 transition-colors duration-200"
                      >
                        Details
                      </button>
                      {onManageMilestones && (
                        <button
                          onClick={() => onManageMilestones(subcontractor, phase, project)}
                          className="px-2 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors duration-200 flex items-center justify-center"
                          title="Manage payment milestones"
                        >
                          <Calendar className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteSubcontractor(subcontractor.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors duration-200"
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
              )
            })}
          </div>
        )}
        </div>
      )}
    </div>
  )
}
