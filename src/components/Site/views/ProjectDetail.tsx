import React from 'react'
import { ArrowLeft, Building2, Settings } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases } from '../types/siteTypes'
import { PhaseCard } from './PhaseCard'

interface ProjectDetailProps {
  project: ProjectWithPhases
  onBack: () => void
  onOpenPhaseSetup: () => void
  onEditPhase: (phase: ProjectPhase) => void
  onDeletePhase: (phase: ProjectPhase) => void
  onAddSubcontractor: (phase: ProjectPhase) => void
  onWirePayment: (subcontractor: Subcontractor) => void
  onOpenPaymentHistory: (subcontractor: Subcontractor) => void
  onEditSubcontractor: (subcontractor: Subcontractor) => void
  onOpenSubDetails: (subcontractor: Subcontractor) => void
  onDeleteSubcontractor: (subcontractorId: string) => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onOpenPhaseSetup,
  onEditPhase,
  onDeletePhase,
  onAddSubcontractor,
  onWirePayment,
  onOpenPaymentHistory,
  onEditSubcontractor,
  onOpenSubDetails,
  onDeleteSubcontractor
}) => {
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
              Budget: €{project.budget.toLocaleString()}
              {project.has_phases && (
                <>
                  <span className="ml-2">
                    • Allocated: €{project.total_budget_allocated.toLocaleString()}
                  </span>
                  <span className="ml-2 text-teal-600 font-medium">
                    • Paid out: €{project.total_paid_out.toLocaleString()}
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
                onWirePayment={onWirePayment}
                onOpenPaymentHistory={onOpenPaymentHistory}
                onEditSubcontractor={onEditSubcontractor}
                onOpenSubDetails={onOpenSubDetails}
                onDeleteSubcontractor={onDeleteSubcontractor}
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
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {project.subcontractors.filter(s => s.budget_realized >= s.cost).length}
            </div>
            <div className="text-sm text-gray-600">Fully Paid</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">€{project.total_subcontractor_cost.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Contract Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">
              €{project.subcontractors.reduce((sum, s) => sum + s.budget_realized, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Paid</div>
          </div>
        </div>
      </div>
    </div>
  )
}
