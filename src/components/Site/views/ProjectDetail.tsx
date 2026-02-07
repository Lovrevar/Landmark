import React, { useState, useEffect } from 'react'
import { ArrowLeft, Building2, Settings, CreditCard, DollarSign, Percent } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases } from '../types/siteTypes'
import { PhaseCard } from './PhaseCard'
import { supabase } from '../../../lib/supabase'
import { Button, Badge, EmptyState } from '../../ui'

interface Company {
  id: string
  name: string
}

interface CreditAllocation {
  id: string
  allocated_amount: number
  used_amount: number
  description: string | null
  bank_credit: {
    id: string
    credit_name: string
    amount: number
    used_amount: number
    repaid_amount: number
    outstanding_balance: number
    interest_rate: number
    company: Company
  }
}

interface ProjectDetailProps {
  project: ProjectWithPhases
  onBack: () => void
  onOpenPhaseSetup: () => void
  onEditPhaseSetup?: () => void
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
  onEditPhaseSetup,
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
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [loadingCredits, setLoadingCredits] = useState(false)

  useEffect(() => {
    fetchProjectCreditAllocations()
  }, [project.id])

  const fetchProjectCreditAllocations = async () => {
    try {
      setLoadingCredits(true)
      const { data, error } = await supabase
        .from('credit_allocations')
        .select(`
          id,
          allocated_amount,
          used_amount,
          description,
          bank_credit:bank_credits!credit_allocations_credit_id_fkey(
            id,
            credit_name,
            amount,
            used_amount,
            repaid_amount,
            outstanding_balance,
            interest_rate,
            company:accounting_companies(id, name)
          )
        `)
        .eq('project_id', project.id)

      if (error) throw error
      setCreditAllocations(data || [])
    } catch (error) {
      console.error('Error fetching project credit allocations:', error)
    } finally {
      setLoadingCredits(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Button
          variant="ghost"
          icon={ArrowLeft}
          size="sm"
          onClick={onBack}
        >
          Back to Projects
        </Button>
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
            <Badge variant={
              project.status === 'Completed' ? 'green' :
              project.status === 'In Progress' ? 'blue' :
              'gray'
            } size="md">
              {project.status}
            </Badge>
            {!project.has_phases ? (
              <Button
                onClick={onOpenPhaseSetup}
                icon={Settings}
              >
                Setup Phases
              </Button>
            ) : (
              onEditPhaseSetup && (
                <Button
                  onClick={onEditPhaseSetup}
                  icon={Settings}
                >
                  Edit Phases
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Project Credits Section */}
      {creditAllocations.length > 0 && (
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center mb-4">
            <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Alocirana sredstva za ovaj projekt</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creditAllocations.map((allocation) => {
              const credit = allocation.bank_credit
              const allocatedAmount = allocation.allocated_amount
              const usedAmount = allocation.used_amount
              const availableAmount = allocatedAmount - usedAmount
              const allocationUsedPercentage = allocatedAmount > 0
                ? (usedAmount / allocatedAmount) * 100
                : 0

              return (
                <div key={allocation.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{credit.credit_name}</h3>
                  <p className="text-xs text-gray-600 mb-3">{credit.company.name}</p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Alocirano:</span>
                      <span className="font-bold text-blue-600">€{allocatedAmount.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Iskorišteno:</span>
                      <span className="font-semibold text-orange-600">€{usedAmount.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Dostupno:</span>
                      <span className={`font-semibold ${availableAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        €{availableAmount.toLocaleString('hr-HR')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Kamatna stopa:</span>
                      <span className="font-semibold text-teal-600">{credit.interest_rate}%</span>
                    </div>
                  </div>

                  {allocation.description && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-600">{allocation.description}</p>
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">Iskorištenost alokacije</span>
                      <span className="font-semibold text-gray-700">{allocationUsedPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          allocationUsedPercentage >= 100 ? 'bg-red-500' :
                          allocationUsedPercentage >= 80 ? 'bg-orange-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(allocationUsedPercentage, 100)}%` }}
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
        <EmptyState
          icon={Building2}
          title="No phases created yet"
          description="Set up construction phases to better organize subcontractors and budget allocation."
          action={
            <Button onClick={onOpenPhaseSetup} icon={Settings}>
              Setup Phases
            </Button>
          }
        />
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
            <div className="text-2xl font-bold text-gray-600">€{project.total_subcontractor_cost.toLocaleString('hr-HR')}</div>
            <div className="text-sm text-gray-600">Contract Total</div>
          </div>
          {canManagePayments && (
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">
                €{project.subcontractors.reduce((sum, s) => sum + s.budget_realized, 0).toLocaleString('hr-HR')}
              </div>
              <div className="text-sm text-gray-600">Total Paid</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
