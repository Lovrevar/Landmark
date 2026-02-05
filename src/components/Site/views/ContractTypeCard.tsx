import React, { useState } from 'react'
import { Plus, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases, ContractType, SubcontractorWithPhase } from '../types/siteTypes'

interface ContractTypeCardProps {
  contractType: ContractType
  project: ProjectWithPhases
  typeSubcontractors: SubcontractorWithPhase[]
  onAddSubcontractor: (phase: ProjectPhase) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
}

export const ContractTypeCard: React.FC<ContractTypeCardProps> = ({
  contractType,
  project,
  typeSubcontractors,
  onAddSubcontractor,
  onOpenPaymentHistory,
  onOpenInvoices,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor,
  onManageMilestones
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const subcontractorsWithContract = typeSubcontractors.filter(sub => sub.has_contract !== false && sub.cost > 0)
  const subcontractorsWithoutContract = typeSubcontractors.filter(sub => sub.has_contract === false || sub.cost === 0)

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              title={isExpanded ? "Collapse group" : "Expand group"}
            >
              {isExpanded ? (
                <ChevronUp className="w-6 h-6 text-gray-600" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-600" />
              )}
            </button>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{contractType.name}</h3>
              <p className="text-gray-600">
                {contractType.description} • {typeSubcontractors.length} subcontractor{typeSubcontractors.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700">Contract Cost</p>
            <p className="text-lg font-bold text-gray-900">€{totalContractCost.toLocaleString('hr-HR')}</p>
          </div>
          <div className="bg-teal-50 p-3 rounded-lg">
            <p className="text-sm text-teal-700">Paid Out</p>
            <p className="text-lg font-bold text-teal-900">€{totalPaidOut.toLocaleString('hr-HR')}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-sm text-orange-700">Unpaid</p>
            <p className="text-lg font-bold text-orange-900">
              €{totalUnpaid.toLocaleString('hr-HR')}
            </p>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {typeSubcontractors.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No subcontractors in this category yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {typeSubcontractors.map((subcontractor) => {
                const hasValidContract = subcontractor.has_contract !== false && subcontractor.cost > 0
                const actualPaid = subcontractor.invoice_total_paid || 0
                const isOverdue = subcontractor.deadline ? new Date(subcontractor.deadline) < new Date() && actualPaid < subcontractor.cost : false
                const daysUntilDeadline = subcontractor.deadline ? differenceInDays(new Date(subcontractor.deadline), new Date()) : 0
                const subVariance = hasValidContract ? actualPaid - subcontractor.cost : 0
                const isPaid = hasValidContract && actualPaid >= subcontractor.cost
                const remainingToPay = hasValidContract ? Math.max(0, subcontractor.cost - actualPaid) : 0

                const phase = project.phases.find(p => p.id === subcontractor.phase_id)

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
                        {phase && (
                          <p className="text-xs text-blue-600 font-medium mb-1">
                            {phase.phase_name}
                          </p>
                        )}
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
                          className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
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
                        {onManageMilestones && phase && (
                          <button
                            onClick={() => onManageMilestones(subcontractor, phase, project)}
                            className="px-2 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors duration-200 flex items-center justify-center"
                            title="Manage payment milestones"
                          >
                            M
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
      )}
    </div>
  )
}
