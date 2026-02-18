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
  Home,
  Briefcase,
  Plus,
  Target
} from 'lucide-react'
import { LoadingSpinner, Badge, Button, FormField, Input, EmptyState, Table } from '../ui'
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

interface CreditAllocationItem {
  id: string
  allocated_amount: number
  used_amount: number
  description: string | null
  created_at: string
  bank_credits?: {
    credit_name: string
    credit_type: string
    start_date: string | null
    banks?: { name: string }
  }
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
  const [investments, setInvestments] = useState<CreditAllocationItem[]>([])
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
        .from('credit_allocations')
        .select(`
          id,
          allocated_amount,
          used_amount,
          description,
          created_at,
          bank_credits(credit_name, credit_type, start_date, banks(name))
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })

      setInvestments((investmentsData || []) as CreditAllocationItem[])
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

  if (loading) {
    return <LoadingSpinner message="Loading project..." />
  }

  if (!project) {
    return <EmptyState icon={Building2} title="Project not found" />
  }

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
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
        <Button icon={Edit2} onClick={() => setShowEditModal(true)}>
          Edit Project
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <p className="text-gray-600">{project.location}</p>
          </div>
          <Badge variant={
            project.status === 'Completed' ? 'green'
              : project.status === 'In Progress' ? 'blue'
              : project.status === 'On Hold' ? 'yellow'
              : 'gray'
          }>
            {project.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Budget</span>
              <DollarSign className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">€{project.budget.toLocaleString('hr-HR')}</p>
            <p className="text-xs text-gray-500 mt-1">
              Spent: €{totalSpent.toLocaleString('hr-HR')}
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

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-orange-700">Team</span>
              <Users className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-orange-900">{contracts.length}</p>
            <p className="text-xs text-orange-600 mt-1">Active contracts</p>
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
                      €{investments.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString('hr-HR')}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <span className="text-sm text-red-700">Total Expenses</span>
                    <p className="text-2xl font-bold text-red-900 mt-1">€{totalSpent.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <span className="text-sm text-green-700">Revenue from Sales</span>
                    <p className="text-2xl font-bold text-green-900 mt-1">€{totalRevenue.toLocaleString('hr-HR')}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Milestones</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('milestones')}>
                    View all
                  </Button>
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
                <EmptyState icon={Briefcase} title="No phases created yet" />
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
                            €{phase.budget_allocated.toLocaleString('hr-HR')}
                          </p>
                          <p className="text-sm text-blue-600">
                            Used: €{phase.budget_used.toLocaleString('hr-HR')}
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
                                    €{contract.contract_amount.toLocaleString('hr-HR')}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Realized: €{contract.budget_realized.toLocaleString('hr-HR')}
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

              <Table>
                <Table.Head>
                  <Table.Tr>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Floor</Table.Th>
                    <Table.Th>Size (m²)</Table.Th>
                    <Table.Th>Price</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Buyer</Table.Th>
                  </Table.Tr>
                </Table.Head>
                <Table.Body>
                  {apartments.map((apt) => (
                    <Table.Tr key={apt.id}>
                      <Table.Td className="font-medium text-gray-900">{apt.number}</Table.Td>
                      <Table.Td>{apt.floor}</Table.Td>
                      <Table.Td>{apt.size_m2}</Table.Td>
                      <Table.Td className="font-semibold text-gray-900">€{apt.price.toLocaleString('hr-HR')}</Table.Td>
                      <Table.Td>
                        <Badge variant={
                          apt.status === 'Sold' ? 'green'
                            : apt.status === 'Reserved' ? 'yellow'
                            : 'blue'
                        } size="sm">
                          {apt.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{apt.buyer_name || '-'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}

          {activeTab === 'subcontractors' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Subcontractors & Contracts</h3>
              {contracts.length === 0 ? (
                <EmptyState icon={Users} title="No contracts yet" />
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
                        <Badge variant={
                          contract.status === 'active' ? 'green'
                            : contract.status === 'completed' ? 'gray'
                            : 'yellow'
                        } size="sm">
                          {contract.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Contract Amount</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            €{contract.contract_amount.toLocaleString('hr-HR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Budget Realized</p>
                          <p className="text-lg font-semibold text-blue-600 mt-1">
                            €{contract.budget_realized.toLocaleString('hr-HR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Remaining</p>
                          <p className="text-lg font-semibold text-green-600 mt-1">
                            €{(contract.contract_amount - contract.budget_realized).toLocaleString('hr-HR')}
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
                <EmptyState icon={DollarSign} title="No credit allocations recorded" />
              ) : (
                <div className="space-y-4">
                  {investments.map((investment) => (
                    <div key={investment.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {investment.bank_credits?.banks?.name || 'Unknown Bank'}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {investment.bank_credits?.credit_name} • {investment.bank_credits?.credit_type?.replace(/_/g, ' ')}
                            {investment.bank_credits?.start_date ? ` • ${format(parseISO(investment.bank_credits.start_date), 'MMM dd, yyyy')}` : ''}
                          </p>
                          {investment.description && (
                            <p className="text-xs text-gray-500 mt-1">{investment.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">€{investment.allocated_amount.toLocaleString('hr-HR')}</p>
                          <p className="text-xs text-gray-500 mt-1">Used: €{investment.used_amount.toLocaleString('hr-HR')}</p>
                        </div>
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
                <Button icon={Plus} onClick={() => setShowMilestoneForm(!showMilestoneForm)}>
                  Add Milestone
                </Button>
              </div>

              {showMilestoneForm && (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4">New Milestone</h4>
                  <div className="space-y-4">
                    <FormField label="Milestone Name">
                      <Input
                        type="text"
                        value={newMilestone.name}
                        onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                        placeholder="e.g., Foundation Complete"
                      />
                    </FormField>
                    <FormField label="Due Date (Optional)">
                      <Input
                        type="date"
                        value={newMilestone.due_date}
                        onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                      />
                    </FormField>
                    <div className="flex space-x-3">
                      <Button onClick={addMilestone}>
                        Add Milestone
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowMilestoneForm(false)
                          setNewMilestone({ name: '', due_date: '', completed: false })
                        }}
                      >
                        Cancel
                      </Button>
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
