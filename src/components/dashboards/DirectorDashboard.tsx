import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Project } from '../../lib/supabase'
import { TrendingUp, DollarSign, Building2, Users, FileText, Download, Plus, Edit2, Trash2, X } from 'lucide-react'
import { generateComprehensiveExecutiveReport } from '../../utils/reportGenerator'

interface ProjectWithStats extends Project {
  total_expenses: number
  apartment_sales: number
  funding: string
}

const DirectorDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [newProject, setNewProject] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    budget: 0,
    investor: '',
    status: 'Planning' as const
  })
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalBudget: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insertingData, setInsertingData] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const addProject = async () => {
    if (!newProject.name.trim() || !newProject.location.trim() || !newProject.start_date) {
      alert('Please fill in required fields (name, location, start date)')
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .insert(newProject)

      if (error) throw error

      resetProjectForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding project:', error)
      alert('Error adding project. Please try again.')
    }
  }

  const updateProject = async () => {
    if (!editingProject || !newProject.name.trim() || !newProject.location.trim()) return

    try {
      const { error } = await supabase
        .from('projects')
        .update(newProject)
        .eq('id', editingProject.id)

      if (error) throw error

      resetProjectForm()
      await fetchData()
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Error updating project.')
    }
  }

  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This will also delete all associated tasks, apartments, and invoices.')) return

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Error deleting project.')
    }
  }

  const resetProjectForm = () => {
    setNewProject({
      name: '',
      location: '',
      start_date: '',
      end_date: '',
      budget: 0,
      investor: '',
      status: 'Planning'
    })
    setEditingProject(null)
    setShowProjectForm(false)
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setNewProject({
      name: project.name,
      location: project.location,
      start_date: project.start_date,
      end_date: project.end_date || '',
      budget: project.budget,
      investor: project.investor || '',
      status: project.status
    })
    setShowProjectForm(true)
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Test basic connection
      console.log('Testing Supabase connection...')
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      console.log('Connection test result:', { testData, testError })
      
      // Fetch projects with calculated stats
      console.log('Fetching projects...')
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectsError) {
        console.error('Projects query error:', projectsError)
        throw projectsError
      }

      console.log('Fetched projects:', projectsData)
      console.log('Projects count:', projectsData?.length || 0)

      // Calculate stats for each project
      const projectsWithStats = await Promise.all(
        (projectsData || []).map(async (project) => {
          // Get total expenses from wire_payments through contracts
          const { data: contracts } = await supabase
            .from('contracts')
            .select('id')
            .eq('project_id', project.id)

          const contractIds = contracts?.map(c => c.id) || []

          let totalExpenses = 0
          if (contractIds.length > 0) {
            const { data: payments } = await supabase
              .from('wire_payments')
              .select('amount')
              .in('contract_id', contractIds)

            totalExpenses = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
          }

          // Get apartment sales revenue
          const { data: apartments } = await supabase
            .from('apartments')
            .select('price')
            .eq('project_id', project.id)
            .eq('status', 'Sold')

          const apartmentSales = apartments?.reduce((sum, apt) => sum + apt.price, 0) || 0

          // Get investors for this project with amounts
          const { data: projectInvestments } = await supabase
            .from('project_investments')
            .select('investor_id, amount')
            .eq('project_id', project.id)

          // Get bank credits for this project
          const { data: bankCredits } = await supabase
            .from('bank_credits')
            .select('bank_id, amount')
            .eq('project_id', project.id)

          let fundingDisplay = 'N/A'
          const fundingSources: Array<{ name: string; amount: number }> = []

          // Add investors
          if (projectInvestments && projectInvestments.length > 0) {
            const investorIds = projectInvestments.map(pi => pi.investor_id)
            const { data: investors } = await supabase
              .from('investors')
              .select('id, name')
              .in('id', investorIds)

            if (investors) {
              projectInvestments.forEach(pi => {
                const investor = investors.find(inv => inv.id === pi.investor_id)
                if (investor) {
                  fundingSources.push({
                    name: investor.name,
                    amount: parseFloat(pi.amount)
                  })
                }
              })
            }
          }

          // Add bank credits
          if (bankCredits && bankCredits.length > 0) {
            const bankIds = bankCredits.map(bc => bc.bank_id)
            const { data: banks } = await supabase
              .from('banks')
              .select('id, name')
              .in('id', bankIds)

            if (banks) {
              bankCredits.forEach(bc => {
                const bank = banks.find(b => b.id === bc.bank_id)
                if (bank) {
                  fundingSources.push({
                    name: bank.name,
                    amount: parseFloat(bc.amount)
                  })
                }
              })
            }
          }

          // Calculate percentages
          if (fundingSources.length > 0) {
            const totalFunding = fundingSources.reduce((sum, fs) => sum + fs.amount, 0)
            const fundingBreakdown = fundingSources.map(fs => {
              const percentage = totalFunding > 0 ? (fs.amount / totalFunding * 100).toFixed(0) : 0
              return `${fs.name} ${percentage}%`
            })
            fundingDisplay = fundingBreakdown.join(', ')
          }

          return {
            ...project,
            total_expenses: totalExpenses,
            apartment_sales: apartmentSales,
            funding: fundingDisplay
          }
        })
      )

      setProjects(projectsWithStats)

      // Calculate overall stats
      const totalProjects = projectsWithStats.length
      const activeProjects = projectsWithStats.filter(p => p.status === 'In Progress').length
      const totalBudget = projectsWithStats.reduce((sum, p) => sum + p.budget, 0)
      const totalRevenue = projectsWithStats.reduce((sum, p) => sum + p.apartment_sales, 0)

      setStats({ totalProjects, activeProjects, totalBudget, totalRevenue })
      console.log('Calculated stats:', { totalProjects, activeProjects, totalBudget, totalRevenue })
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    setGeneratingReport(true)
    try {
      await generateComprehensiveExecutiveReport()
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Failed to generate report. Please try again.')
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error loading dashboard: {error}</div>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">
                  €{stats.totalBudget.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  €{stats.totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">
                €{stats.totalBudget.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                €{stats.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Project Overview</h2>
            <button
              onClick={() => setShowProjectForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expenses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funding
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <button
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors duration-200"
                      >
                        {project.name}
                      </button>
                      <div className="text-sm text-gray-500">{project.location}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{project.budget.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{project.total_expenses.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{project.apartment_sales.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {project.funding}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditProject(project)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200"
                        title="Edit project"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Form Modal */}
      {showProjectForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingProject ? 'Edit Project' : 'Create New Project'}
                </h3>
                <button
                  onClick={resetProjectForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project name"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                  <input
                    type="text"
                    value={newProject.location}
                    onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project location"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={newProject.start_date}
                    onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={newProject.end_date}
                    onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Budget (€)</label>
                  <input
                    type="number"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({ ...newProject, budget: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Investor</label>
                  <input
                    type="text"
                    value={newProject.investor}
                    onChange={(e) => setNewProject({ ...newProject, investor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter investor name (optional)"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetProjectForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingProject ? updateProject : addProject}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingProject ? 'Update' : 'Create'} Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Generation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Comprehensive Executive Report</h2>
            <p className="text-gray-600 mt-1">All-in-one report with sales, funding, construction, cash flow, and risk analysis</p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport || projects.length === 0}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {generatingReport ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate Executive Report
              </>
            )}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <FileText className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">Sales & Financial Performance</span>
            </div>
            <p className="text-sm text-blue-700">Complete sales metrics, revenue, profit margins, and customer analytics</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              <span className="font-medium text-green-900">Funding & Construction Status</span>
            </div>
            <p className="text-sm text-green-700">Capital structure, debt analysis, contracts, and work progress tracking</p>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <Download className="w-5 h-5 text-orange-600 mr-2" />
              <span className="font-medium text-orange-900">Cash Flow & Risk Assessment</span>
            </div>
            <p className="text-sm text-orange-700">6-month cash flow analysis with risk evaluation and recommendations</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DirectorDashboard