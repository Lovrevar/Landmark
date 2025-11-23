import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, DollarSign, Briefcase, Phone, Mail, Calendar, TrendingUp, AlertCircle } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface SubcontractorContract {
  id: string
  project_name: string
  phase_name: string | null
  job_description: string
  cost: number
  budget_realized: number
  progress: number
  deadline: string
  created_at: string
}

interface SubcontractorSummary {
  name: string
  contact: string
  total_contracts: number
  total_contract_value: number
  total_paid: number
  total_remaining: number
  active_contracts: number
  completed_contracts: number
  contracts: SubcontractorContract[]
}

const SubcontractorManagement: React.FC = () => {
  const [subcontractors, setSubcontractors] = useState<Map<string, SubcontractorSummary>>(new Map())
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<SubcontractorSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch all active contracts with subcontractor, phase, and project info
      const { data: contractsData, error } = await supabase
        .from('contracts')
        .select(`
          *,
          subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact, progress),
          phase:project_phases!contracts_phase_id_fkey(
            phase_name,
            project:projects!project_phases_project_id_fkey(name)
          )
        `)
        .eq('status', 'active')
        .order('subcontractor(name)')

      if (error) throw error

      // Group contracts by subcontractor name and contact
      const grouped = new Map<string, SubcontractorSummary>()

      contractsData?.forEach((contractData: any) => {
        const sub = contractData.subcontractor
        const phase = contractData.phase
        const key = `${sub.name}|${sub.contact}`

        const contract: SubcontractorContract = {
          id: contractData.id,
          project_name: phase?.project?.name || 'Unknown Project',
          phase_name: phase?.phase_name || null,
          job_description: contractData.job_description || '',
          cost: parseFloat(contractData.contract_amount || 0),
          budget_realized: parseFloat(contractData.budget_realized || 0),
          progress: sub.progress || 0,
          deadline: contractData.end_date || '',
          created_at: contractData.created_at
        }

        if (grouped.has(key)) {
          const existing = grouped.get(key)!
          existing.total_contracts++
          existing.total_contract_value += contract.cost
          existing.total_paid += contract.budget_realized
          existing.total_remaining += (contract.cost - contract.budget_realized)
          if (contract.progress < 100) {
            existing.active_contracts++
          } else {
            existing.completed_contracts++
          }
          existing.contracts.push(contract)
        } else {
          grouped.set(key, {
            name: sub.name,
            contact: sub.contact,
            total_contracts: 1,
            total_contract_value: contract.cost,
            total_paid: contract.budget_realized,
            total_remaining: contract.cost - contract.budget_realized,
            active_contracts: contract.progress < 100 ? 1 : 0,
            completed_contracts: contract.progress >= 100 ? 1 : 0,
            contracts: [contract]
          })
        }
      })

      setSubcontractors(grouped)
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading subcontractors...</div>
  }

  const subcontractorsList = Array.from(subcontractors.values())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subcontractors</h1>
          <p className="text-gray-600 mt-2">Overview of all subcontractors and their contracts</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Subcontractors</p>
          <p className="text-2xl font-bold text-gray-900">{subcontractorsList.length}</p>
        </div>
      </div>

      {subcontractorsList.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subcontractors Yet</h3>
          <p className="text-gray-600">Add subcontractors from Site Management</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {subcontractorsList.map((sub) => {
            const paymentPercentage = sub.total_contract_value > 0
              ? (sub.total_paid / sub.total_contract_value) * 100
              : 0

            return (
              <div
                key={`${sub.name}|${sub.contact}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                onClick={() => setSelectedSubcontractor(sub)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{sub.name}</h3>
                    <p className="text-sm text-gray-600">{sub.contact}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    sub.active_contracts > 0 ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Briefcase className={`w-5 h-5 ${
                      sub.active_contracts > 0 ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Contracts:</span>
                    <span className="font-medium text-gray-900">{sub.total_contracts}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Active / Completed:</span>
                    <span className="font-medium text-gray-900">
                      {sub.active_contracts} / {sub.completed_contracts}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Total Value:</span>
                    <span className="font-bold text-gray-900">€{sub.total_contract_value.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-medium text-teal-600">€{sub.total_paid.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-medium text-orange-600">€{sub.total_remaining.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-600">Payment Progress</span>
                    <span className="text-xs font-medium text-gray-900">{paymentPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, paymentPercentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedSubcontractor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedSubcontractor.name}</h2>
                  <p className="text-gray-600 mt-1">{selectedSubcontractor.contact}</p>
                </div>
                <button
                  onClick={() => setSelectedSubcontractor(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <AlertCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">Total Contracts</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedSubcontractor.total_contracts}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">Contract Value</p>
                  <p className="text-2xl font-bold text-gray-900">€{selectedSubcontractor.total_contract_value.toLocaleString()}</p>
                </div>
                <div className="bg-teal-50 p-4 rounded-lg">
                  <p className="text-sm text-teal-700">Total Paid</p>
                  <p className="text-2xl font-bold text-teal-900">€{selectedSubcontractor.total_paid.toLocaleString()}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-700">Remaining</p>
                  <p className="text-2xl font-bold text-orange-900">€{selectedSubcontractor.total_remaining.toLocaleString()}</p>
                </div>
              </div>

              {/* Contracts List */}
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Contracts</h3>
              <div className="space-y-4">
                {selectedSubcontractor.contracts.map((contract) => {
                  const isOverdue = new Date(contract.deadline) < new Date() && contract.progress < 100
                  const daysUntilDeadline = differenceInDays(new Date(contract.deadline), new Date())
                  const remaining = contract.cost - contract.budget_realized

                  return (
                    <div key={contract.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{contract.project_name}</h4>
                          {contract.phase_name && (
                            <p className="text-sm text-gray-600">{contract.phase_name}</p>
                          )}
                          <p className="text-sm text-gray-600 mt-1">{contract.job_description}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          contract.progress >= 100 ? 'bg-green-100 text-green-800' :
                          contract.progress > 0 ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {contract.progress}% Complete
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <p className="text-gray-600">Contract:</p>
                          <p className="font-medium text-gray-900">€{contract.cost.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Paid:</p>
                          <p className="font-medium text-teal-600">€{contract.budget_realized.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Remaining:</p>
                          <p className="font-medium text-orange-600">€{remaining.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Deadline:</p>
                          <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                            {format(new Date(contract.deadline), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>

                      {isOverdue && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          ⚠️ Overdue by {Math.abs(daysUntilDeadline)} days
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubcontractorManagement
