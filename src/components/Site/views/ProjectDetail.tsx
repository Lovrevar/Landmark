import React, { useState, useEffect } from 'react'
import { ArrowLeft, Building2, Settings, CreditCard, DollarSign, Percent } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases } from '../types/siteTypes'
import { PhaseCard } from './PhaseCard'
import { supabase } from '../../../lib/supabase'

interface Company {
  id: string
  name: string
}

interface Credit {
  id: string
  credit_name: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  company: Company
}

interface ProjectDetailProps {
  project: ProjectWithPhases
  onBack: () => void
  onOpenPhaseSetup: () => void
  onEditPhase: (phase: ProjectPhase) => void
  onDeletePhase: (phase: ProjectPhase) => void
  onAddSubcontractor: (phase: ProjectPhase) => void
  onOpenPaymentHistory?: (subcontractor: Subcontractor) => void
  onOpenInvoices?: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
  onManageMilestones?: (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => void
  canManagePayments?: boolean
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onOpenPhaseSetup,
  onEditPhase,
  onDeletePhase,
  onAddSubcontractor,
  onOpenPaymentHistory,
  onOpenInvoices,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor,
  onManageMilestones,
  canManagePayments = true
}) => {
  const [credits, setCredits] = useState<Credit[]>([])
  const [loadingCredits, setLoadingCredits] = useState(false)

  useEffect(() => {
    fetchProjectCredits()
  }, [project.id])

  const fetchProjectCredits = async () => {
    try {
      setLoadingCredits(true)
      const { data, error } = await supabase
        .from('bank_credits')
        .select(`
          id,
          credit_name,
          amount,
          used_amount,
          repaid_amount,
          outstanding_balance,
          interest_rate,
          company:accounting_companies(id, name)
        `)
        .eq('project_id', project.id)

      if (error) throw error
      setCredits(data || [])
    } catch (error) {
      console.error('Error fetching project credits:', error)
    } finally {
      setLoadingCredits(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">{project.location}</p>
            <p className="text-sm text-gray-500 mt-1">
              Budget: €{project.budget.toLocaleString('hr-HR')}
              {project.has_phases && (
                <>
                  <span className="ml-2">
                    • Allocated: €{project.total_budget_allocated.toLocaleString('hr-HR')}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              project.status === 'Completed' ? 'bg-green-100 text-green-800' :
              project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {project.status}
            </span>
            {!project.has_phases && (
              <button
                onClick={onOpenPhaseSetup}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Settings className="w-4 h-4 mr-2" />
                Setup Phases
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Project Credits Section */}
      {credits.length > 0 && (
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center mb-4">
            <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Bank Credits for This Project</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {credits.map((credit) => {
              const usedAmount = credit.used_amount || 0
              const available = credit.amount - usedAmount
              const utilizationPercent = credit.amount > 0
                ? (usedAmount / credit.amount) * 100
                : 0

              return (
                <div key={credit.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{credit.credit_name}</h3>
                  <p className="text-xs text-gray-600 mb-3">{credit.company.name}</p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Credit Limit:</span>
                      <span className="font-semibold text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Used:</span>
                      <span className="font-semibold text-blue-600">€{usedAmount.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Available:</span>
                      <span className="font-semibold text-green-600">€{available.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Interest Rate:</span>
                      <span className="font-semibold text-orange-600">{credit.interest_rate}%</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">Utilization</span>
                      <span className="font-semibold text-gray-700">{utilizationPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
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
          </div>
        </div>
      )}

      {project.has_phases ? (
        <div className="space-y-6">
          {project.phases.map((phase) => {
            const phaseSubcontractors = project.subcontractors.filter(sub => sub.phase_id === phase.id)

            return (
              <PhaseCard
                key={phase.id}
                phase={phase}
                project={project}
                phaseSubcontractors={phaseSubcontractors}
                onEditPhase={onEditPhase}
                onDeletePhase={onDeletePhase}
                onAddSubcontractor={onAddSubcontractor}
                onOpenPaymentHistory={onOpenPaymentHistory}
                onOpenInvoices={onOpenInvoices}
                onEditSubcontractor={onEditSubcontractor}
                onOpenSubDetails={onOpenSubDetails}
                onDeleteSubcontractor={onDeleteSubcontractor}
                onManageMilestones={onManageMilestones}
              />
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Phases Not Set Up</h3>
            <p className="text-gray-600 mb-4">
              Set up construction phases to better organize subcontractors and budget allocation.
            </p>
            <button
              onClick={onOpenPhaseSetup}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Setup Project Phases
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{project.subcontractors.length}</div>
            <div className="text-sm text-gray-600">Total Subcontractors</div>
          </div>
          {canManagePayments && (
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {project.subcontractors.filter(s => s.budget_realized >= s.cost).length}
              </div>
              <div className="text-sm text-gray-600">Fully Paid</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">€{project.total_subcontractor_cost.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Contract Total</div>
          </div>
          {canManagePayments && (
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">
                €{project.subcontractors.reduce((sum, s) => sum + s.budget_realized, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Paid</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
