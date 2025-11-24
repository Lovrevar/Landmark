import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Building2,
  ArrowLeft,
  Edit2,
  DollarSign,
  Calendar,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  Pause,
  AlertTriangle,
  Home,
  FileText,
  Briefcase,
  Plus,
  Target,
  Activity
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import MilestoneTimeline from './MilestoneTimeline'
import ProjectFormModal from './ProjectFormModal'

interface Project {
  id: string
  name: string
  location: string
  start_date: string
  end_date: string | null
  budget: number
  investor: string | null
  status: string
  created_at: string
}

interface Milestone {
  id: string
  name: string
  due_date: string | null
  completed: boolean
}

interface Phase {
  id: string
  phase_number: number
  phase_name: string
  budget_allocated: number
  budget_used: number
  start_date: string | null
  end_date: string | null
  status: string
}

interface Contract {
  id: string
  contract_number: string
  subcontractor: { id: string; name: string; contact: string }
  job_description: string
  contract_amount: number
  budget_realized: number
  status: string
  start_date: string | null
  end_date: string | null
  phase: { phase_name: string } | null
}

interface Apartment {
  id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: string
  buyer_name: string | null
}

interface Investment {
  id: string
  amount: number
  investment_type: string
  investment_date: string
  investor?: { name: string }
  bank?: { name: string }
}

type TabType = 'overview' | 'phases' | 'apartments' | 'subcontractors' | 'financing' | 'milestones'

const ProjectDetailsEnhanced: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [newMilestone, setNewMilestone] = useState({ name: '', due_date: '', completed: false })

  useEffect(() => {
    if (id) {
      fetchProjectData()
    }
  }, [id])

  const fetchProjectData = async () => {
    if (!id) return

    try {
      setLoading(true)

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      const { data: milestonesData } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', id)
        .order('due_date', { ascending: true })

      setMilestones(milestonesData || [])

      const { data: phasesData } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', id)
        .order('phase_number', { ascending: true })

      setPhases(phasesData || [])

      const { data: contractsData } = await supabase
        .from('contracts')
        .select(`
          *,
          subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
          phase:project_phases!contracts_phase_id_fkey(phase_name)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })

      setContracts(contractsData || [])

      const { data: apartmentsData } = await supabase
        .from('apartments')
        .select('*')
        .eq('project_id', id)
        .order('floor', { ascending: true })

      setApartments(apartmentsData || [])

      const { data: investmentsData } = await supabase
        .from('project_investments')
        .select(`
          *,
          investor:investors(name),
          bank:banks(name)
        `)
        .eq('project_id', id)
        .order('investment_date', { ascending: false })

      setInvestments(investmentsData || [])
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }

  const addMilestone = async () => {
    if (!newMilestone.name.trim() || !id) {
      alert('Please enter milestone name')
      return
    }

    try {
      const { error } = await supabase
        .from('project_milestones')
        .insert({
          project_id: id,
          name: newMilestone.name,
          due_date: newMilestone.due_date || null,
          completed: false
        })

      if (error) throw error

      setNewMilestone({ name: '', due_date: '', completed: false })
      setShowMilestoneForm(false)
      fetchProjectData()
    } catch (error) {
      console.error('Error adding milestone:', error)
      alert('Error adding milestone')
    }
  }

  const toggleMilestoneCompletion = async (milestoneId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({ completed: !completed })
        .eq('id', milestoneId)

      if (error) throw error
      fetchProjectData()
    } catch (error) {
      console.error('Error updating milestone:', error)
    }
  }

  const deleteMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return

    try {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', milestoneId)

      if (error) throw error
      fetchProjectData()
    } catch (error) {
      console.error('Error deleting milestone:', error)
    }
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      'Planning': { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Planning' },
      'In Progress': { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100', label: 'In Progress' },
      'Completed': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
      'On Hold': { icon: Pause, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'On Hold' }
    }
    return configs[status as keyof typeof configs] || configs['Planning']
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-2">Loading project...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Project not found</p>
      </div>
    )
  }

  const statusConfig = getStatusConfig(project.status)
  const totalSpent = contracts.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0)
  const totalRevenue = apartments.filter(a => a.status === 'Sold').reduce((sum, a) => sum + Number(a.price), 0)
  const completionPercentage = milestones.length > 0
    ? Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)
    : 0

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'phases', label: 'Phases & Contracts', icon: Briefcase },
    { id: 'apartments', label: 'Apartments', icon: Home },
    { id: 'subcontractors', label: 'Subcontractors', icon: Users },
    { id: 'financing', label: 'Financing', icon: DollarSign },
    { id: 'milestones', label: 'Milestones', icon: Target }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Projects</span>
        </button>
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Edit2 className="w-4 h-4" />
          <span>Edit Project</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <p className="text-gray-600">{project.location}</p>
          </div>
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${statusConfig.bg}`}>
            <statusConfig.icon className={`w-5 h-5 ${statusConfig.color}`} />
            <span className={`font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Budget</span>
              <DollarSign className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">€{project.budget.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              Spent: €{totalSpent.toLocaleString()}
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-700">Timeline</span>
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {project.end_date
                ? `${differenceInDays(parseISO(project.end_date), new Date())} days`
                : 'Ongoing'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {format(parseISO(project.start_date), 'MMM dd, yyyy')}
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-700">Progress</span>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-900">{completionPercentage}%</p>
            <div className="w-full bg-green-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-purple-700">Team</span>
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-purple-900">{contracts.length}</p>
            <p className="text-xs text-purple-600 mt-1">Active contracts</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Project Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <span className="text-sm text-gray-600">Location</span>
                    <p className="text-gray-900 font-medium mt-1">{project.location}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <span className="text-sm text-gray-600">Investor</span>
                    <p className="text-gray-900 font-medium mt-1">{project.investor || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <span className="text-sm text-gray-600">Start Date</span>
                    <p className="text-gray-900 font-medium mt-1">
                      {format(parseISO(project.start_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <span className="text-sm text-gray-600">End Date</span>
                    <p className="text-gray-900 font-medium mt-1">
                      {project.end_date ? format(parseISO(project.end_date), 'MMMM dd, yyyy') : 'Ongoing'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Financial Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <span className="text-sm text-blue-700">Total Investment</span>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      €{investments.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <span className="text-sm text-red-700">Total Expenses</span>
                    <p className="text-2xl font-bold text-red-900 mt-1">€{totalSpent.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <span className="text-sm text-green-700">Revenue from Sales</span>
                    <p className="text-2xl font-bold text-green-900 mt-1">€{totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Milestones</h3>
                  <button
                    onClick={() => setActiveTab('milestones')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View all
                  </button>
                </div>
                <MilestoneTimeline
                  milestones={milestones.slice(0, 3)}
                  editable={false}
                />
              </div>
            </div>
          )}

          {activeTab === 'phases' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Project Phases</h3>
              </div>
              {phases.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No phases created yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {phases.map((phase) => (
                    <div key={phase.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            Phase {phase.phase_number}: {phase.phase_name}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Status: <span className="font-medium">{phase.status}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Budget</p>
                          <p className="text-lg font-semibold text-gray-900">
                            €{phase.budget_allocated.toLocaleString()}
                          </p>
                          <p className="text-sm text-blue-600">
                            Used: €{phase.budget_used.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <h5 className="font-medium text-gray-900 mb-3">Contracts in this phase</h5>
                        <div className="space-y-2">
                          {contracts
                            .filter((c) => c.phase?.phase_name === phase.phase_name)
                            .map((contract) => (
                              <div
                                key={contract.id}
                                className="bg-gray-50 rounded-lg p-3 flex justify-between items-center"
                              >
                                <div>
                                  <p className="font-medium text-gray-900">{contract.subcontractor.name}</p>
                                  <p className="text-sm text-gray-600">{contract.job_description}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-900">
                                    €{contract.contract_amount.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Realized: €{contract.budget_realized.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          {contracts.filter((c) => c.phase?.phase_name === phase.phase_name).length === 0 && (
                            <p className="text-sm text-gray-500 italic">No contracts in this phase</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'apartments' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <span className="text-sm text-green-700">Sold</span>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {apartments.filter((a) => a.status === 'Sold').length}
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <span className="text-sm text-yellow-700">Reserved</span>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">
                    {apartments.filter((a) => a.status === 'Reserved').length}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <span className="text-sm text-blue-700">Available</span>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {apartments.filter((a) => a.status === 'Available').length}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size (m²)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {apartments.map((apt) => (
                      <tr key={apt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{apt.number}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">{apt.floor}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">{apt.size_m2}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                          €{apt.price.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              apt.status === 'Sold'
                                ? 'bg-green-100 text-green-800'
                                : apt.status === 'Reserved'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">{apt.buyer_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'subcontractors' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Subcontractors & Contracts</h3>
              {contracts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No contracts yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{contract.subcontractor.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{contract.job_description}</p>
                          {contract.phase && (
                            <p className="text-sm text-blue-600 mt-1">Phase: {contract.phase.phase_name}</p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            contract.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : contract.status === 'completed'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {contract.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Contract Amount</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            €{contract.contract_amount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Budget Realized</p>
                          <p className="text-lg font-semibold text-blue-600 mt-1">
                            €{contract.budget_realized.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Remaining</p>
                          <p className="text-lg font-semibold text-green-600 mt-1">
                            €{(contract.contract_amount - contract.budget_realized).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Contact</p>
                          <p className="text-sm text-gray-900 mt-1">{contract.subcontractor.contact}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'financing' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Funding Sources</h3>
              {investments.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No investments recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {investments.map((investment) => (
                    <div key={investment.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {investment.investor?.name || investment.bank?.name || 'Unknown'}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Type: {investment.investment_type} • {format(parseISO(investment.investment_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-blue-600">€{investment.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'milestones' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Project Milestones</h3>
                <button
                  onClick={() => setShowMilestoneForm(!showMilestoneForm)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Milestone</span>
                </button>
              </div>

              {showMilestoneForm && (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4">New Milestone</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Milestone Name</label>
                      <input
                        type="text"
                        value={newMilestone.name}
                        onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Foundation Complete"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date (Optional)</label>
                      <input
                        type="date"
                        value={newMilestone.due_date}
                        onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={addMilestone}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Add Milestone
                      </button>
                      <button
                        onClick={() => {
                          setShowMilestoneForm(false)
                          setNewMilestone({ name: '', due_date: '', completed: false })
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <MilestoneTimeline
                milestones={milestones}
                onToggleComplete={toggleMilestoneCompletion}
                onDelete={deleteMilestone}
                editable={true}
              />
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <ProjectFormModal
          projectId={id}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false)
            fetchProjectData()
          }}
        />
      )}
    </div>
  )
}

export default ProjectDetailsEnhanced
