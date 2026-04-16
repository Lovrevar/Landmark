import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
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
import { LoadingSpinner, Badge, Button, FormField, Input, EmptyState, Table } from '../../ui'
import { format, differenceInDays, parseISO } from 'date-fns'
import MilestoneTimeline from './MilestoneTimeline'
import ProjectFormModal from './forms/ProjectFormModal'
import { fetchProjectDataEnhanced } from './services/projectDetailsService'
import { useMilestoneManagement } from './hooks/useMilestoneManagement'
import type { Phase, ContractWithDetails, ApartmentItem, CreditAllocationItem, Milestone, TabType, ProjectDisplay } from './types'

const ProjectDetailsEnhanced: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDisplay | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [contracts, setContracts] = useState<ContractWithDetails[]>([])
  const [apartments, setApartments] = useState<ApartmentItem[]>([])
  const [investments, setInvestments] = useState<CreditAllocationItem[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [newMilestone, setNewMilestone] = useState({ name: '', due_date: '', completed: false })

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const data = await fetchProjectDataEnhanced(id)
      setProject(data.project)
      setMilestones(data.milestones)
      setPhases(data.phases)
      setContracts(data.contracts)
      setApartments(data.apartments)
      setInvestments(data.investments)
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  const { handleAddMilestone, handleToggleMilestone, handleDeleteMilestone } = useMilestoneManagement(id, loadData)

  useEffect(() => {
    if (id) loadData()
  }, [id, loadData])

  const handleSubmitMilestone = async () => {
    await handleAddMilestone({ name: newMilestone.name, due_date: newMilestone.due_date || null, completed: false })
    setNewMilestone({ name: '', due_date: '', completed: false })
    setShowMilestoneForm(false)
  }

  if (loading) return <LoadingSpinner message={t('general_projects.loading')} />
  if (!project) return <EmptyState icon={Building2} title={t('general_projects.not_found')} />

  const totalSpent = contracts.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0)
  const totalRevenue = apartments.filter(a => a.status === 'Sold').reduce((sum, a) => sum + Number(a.price), 0)
  const completionPercentage = milestones.length > 0
    ? Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)
    : 0

  const tabs = [
    { id: 'overview', label: t('common.overview'), icon: Building2 },
    { id: 'phases', label: t('general_projects.tab_phases'), icon: Briefcase },
    { id: 'apartments', label: t('common.apartments'), icon: Home },
    { id: 'subcontractors', label: t('common.subcontractors'), icon: Users },
    { id: 'financing', label: t('general_projects.tab_financing'), icon: DollarSign },
    { id: 'milestones', label: t('general_projects.milestones'), icon: Target }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/projects')}>
          {t('general_projects.back_to_projects')}
        </Button>
        <Button icon={Edit2} onClick={() => setShowEditModal(true)}>{t('general_projects.edit_project')}</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{project.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">{project.location}</p>
          </div>
          <Badge variant={
            project.status === 'Completed' ? 'green'
              : project.status === 'In Progress' ? 'blue'
              : project.status === 'On Hold' ? 'yellow' : 'gray'
          }>
            {project.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.budget')}</span>
              <DollarSign className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">€{project.budget.toLocaleString('hr-HR')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('general_projects.card_spent')}: €{totalSpent.toLocaleString('hr-HR')}</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-700 dark:text-blue-300">{t('general_projects.timeline')}</span>
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {project.end_date ? `${differenceInDays(parseISO(project.end_date), new Date())} ${t('general_projects.days')}` : t('general_projects.ongoing')}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">{format(parseISO(project.start_date), 'MMM dd, yyyy')}</p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-700 dark:text-green-400">{t('general_projects.card_progress')}</span>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{completionPercentage}%</p>
            <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2 mt-2">
              <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${completionPercentage}%` }} />
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-orange-700 dark:text-orange-400">{t('general_projects.team')}</span>
              <Users className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{contracts.length}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{t('general_projects.stat_active_contracts')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('general_projects.project_info')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('general_projects.location')}</span>
                    <p className="text-gray-900 dark:text-white font-medium mt-1">{project.location}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.investor')}</span>
                    <p className="text-gray-900 dark:text-white font-medium mt-1">{project.investor || t('general_projects.na')}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.start_date')}</span>
                    <p className="text-gray-900 dark:text-white font-medium mt-1">{format(parseISO(project.start_date), 'MMMM dd, yyyy')}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.end_date')}</span>
                    <p className="text-gray-900 dark:text-white font-medium mt-1">
                      {project.end_date ? format(parseISO(project.end_date), 'MMMM dd, yyyy') : t('general_projects.ongoing')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('general_projects.financial_summary')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                    <span className="text-sm text-blue-700 dark:text-blue-300">{t('general_projects.total_investment')}</span>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                      €{investments.reduce((sum, inv) => sum + Number(inv.allocated_amount), 0).toLocaleString('hr-HR')}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                    <span className="text-sm text-red-700 dark:text-red-400">{t('general_projects.total_expenses')}</span>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-300 mt-1">€{totalSpent.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                    <span className="text-sm text-green-700 dark:text-green-400">{t('general_projects.revenue_from_sales')}</span>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">€{totalRevenue.toLocaleString('hr-HR')}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.recent_milestones')}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('milestones')}>{t('general_projects.view_all')}</Button>
                </div>
                <MilestoneTimeline milestones={milestones.slice(0, 3)} editable={false} />
              </div>
            </div>
          )}

          {activeTab === 'phases' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.project_phases')}</h3>
              </div>
              {phases.length === 0 ? (
                <EmptyState icon={Briefcase} title={t('general_projects.no_phases')} />
              ) : (
                <div className="space-y-4">
                  {phases.map((phase) => (
                    <div key={phase.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('common.phase')} {phase.phase_number}: {phase.phase_name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('common.status')}: <span className="font-medium">{phase.status}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.budget')}</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">€{phase.budget_allocated.toLocaleString('hr-HR')}</p>
                          <p className="text-sm text-blue-600">{t('general_projects.used')}: €{phase.budget_used.toLocaleString('hr-HR')}</p>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-3">{t('general_projects.contracts_in_phase')}</h5>
                        <div className="space-y-2">
                          {contracts.filter((c) => c.phase?.phase_name === phase.phase_name).map((contract) => (
                            <div key={contract.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{contract.subcontractor.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{contract.job_description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">€{contract.contract_amount.toLocaleString('hr-HR')}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{t('general_projects.realized')}: €{contract.budget_realized.toLocaleString('hr-HR')}</p>
                              </div>
                            </div>
                          ))}
                          {contracts.filter((c) => c.phase?.phase_name === phase.phase_name).length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('general_projects.no_contracts_in_phase')}</p>
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
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                  <span className="text-sm text-green-700 dark:text-green-400">{t('status.sold')}</span>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{apartments.filter((a) => a.status === 'Sold').length}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                  <span className="text-sm text-yellow-700 dark:text-yellow-400">{t('status.reserved')}</span>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">{apartments.filter((a) => a.status === 'Reserved').length}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <span className="text-sm text-blue-700 dark:text-blue-300">{t('status.available')}</span>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{apartments.filter((a) => a.status === 'Available').length}</p>
                </div>
              </div>
              <Table>
                <Table.Head>
                  <Table.Tr>
                    <Table.Th>{t('common.unit')}</Table.Th>
                    <Table.Th>{t('common.floor')}</Table.Th>
                    <Table.Th>{t('general_projects.size_m2')}</Table.Th>
                    <Table.Th>{t('general_projects.price')}</Table.Th>
                    <Table.Th>{t('common.status')}</Table.Th>
                    <Table.Th>{t('general_projects.buyer')}</Table.Th>
                  </Table.Tr>
                </Table.Head>
                <Table.Body>
                  {apartments.map((apt) => (
                    <Table.Tr key={apt.id}>
                      <Table.Td className="font-medium text-gray-900 dark:text-white">{apt.number}</Table.Td>
                      <Table.Td>{apt.floor}</Table.Td>
                      <Table.Td>{apt.size_m2}</Table.Td>
                      <Table.Td className="font-semibold text-gray-900 dark:text-white">€{apt.price.toLocaleString('hr-HR')}</Table.Td>
                      <Table.Td>
                        <Badge variant={apt.status === 'Sold' ? 'green' : apt.status === 'Reserved' ? 'yellow' : 'blue'} size="sm">
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.subcontractors_contracts')}</h3>
              {contracts.length === 0 ? (
                <EmptyState icon={Users} title={t('general_projects.no_contracts')} />
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{contract.subcontractor.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{contract.job_description}</p>
                          {contract.phase && (
                            <p className="text-sm text-blue-600 mt-1">{t('common.phase')}: {contract.phase.phase_name}</p>
                          )}
                        </div>
                        <Badge variant={
                          contract.status === 'active' ? 'green' : contract.status === 'completed' ? 'gray' : 'yellow'
                        } size="sm">
                          {contract.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{t('general_projects.contract_amount')}</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">€{contract.contract_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{t('general_projects.budget_realized')}</p>
                          <p className="text-lg font-semibold text-blue-600 mt-1">€{contract.budget_realized.toLocaleString('hr-HR')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.remaining')}</p>
                          <p className="text-lg font-semibold text-green-600 mt-1">
                            €{(contract.contract_amount - contract.budget_realized).toLocaleString('hr-HR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{t('general_projects.contact')}</p>
                          <p className="text-sm text-gray-900 dark:text-white mt-1">{contract.subcontractor.contact}</p>
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.funding_sources')}</h3>
              {investments.length === 0 ? (
                <EmptyState icon={DollarSign} title={t('general_projects.no_credit_allocations')} />
              ) : (
                <div className="space-y-4">
                  {investments.map((investment) => (
                    <div key={investment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {investment.bank_credits?.banks?.name || 'Unknown Bank'}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {investment.bank_credits?.credit_name} • {investment.bank_credits?.credit_type?.replace(/_/g, ' ')}
                            {investment.bank_credits?.start_date ? ` • ${format(parseISO(investment.bank_credits.start_date), 'MMM dd, yyyy')}` : ''}
                          </p>
                          {investment.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{investment.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">€{investment.allocated_amount.toLocaleString('hr-HR')}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('general_projects.used')}: €{investment.used_amount.toLocaleString('hr-HR')}</p>
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('general_projects.milestones_title')}</h3>
                <Button icon={Plus} onClick={() => setShowMilestoneForm(!showMilestoneForm)}>{t('general_projects.add_milestone')}</Button>
              </div>

              {showMilestoneForm && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">{t('general_projects.new_milestone')}</h4>
                  <div className="space-y-4">
                    <FormField label={t('general_projects.milestone_name')}>
                      <Input
                        type="text"
                        value={newMilestone.name}
                        onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                        placeholder={t('general_projects.milestone_name_placeholder_short')}
                      />
                    </FormField>
                    <FormField label={t('general_projects.milestone_due_date_optional')}>
                      <Input
                        type="date"
                        value={newMilestone.due_date}
                        onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                      />
                    </FormField>
                    <div className="flex space-x-3">
                      <Button onClick={handleSubmitMilestone}>{t('general_projects.add_milestone')}</Button>
                      <Button variant="secondary" onClick={() => {
                        setShowMilestoneForm(false)
                        setNewMilestone({ name: '', due_date: '', completed: false })
                      }}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <MilestoneTimeline
                milestones={milestones}
                onToggleComplete={handleToggleMilestone}
                onDelete={handleDeleteMilestone}
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
            loadData()
          }}
        />
      )}
    </div>
  )
}

export default ProjectDetailsEnhanced
