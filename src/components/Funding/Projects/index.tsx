import React, { useState, useEffect } from 'react'
import {
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Eye,
  PieChart
} from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, Badge, Button } from '../../ui'
import { format } from 'date-fns'
import type { ProjectWithFinancials } from '../../General/Projects/types'
import { fetchInvestmentProjects } from './Services/investmentService'
import InvestmentProjectModal from './Modals/InvestmentProjectModal'

const getFundingColor = (ratio: number) => {
  if (ratio >= 100) return 'text-green-600'
  if (ratio >= 80) return 'text-blue-600'
  return 'text-orange-600'
}

const InvestmentProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithFinancials[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithFinancials | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await fetchInvestmentProjects()
      setProjects(data)
    } catch (error) {
      console.error('Error fetching investment projects:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading investment projects..." />
  }

  return (
    <div>
      <PageHeader
        title="Investment Projects"
        description="Monitor project financing, investments, and financial performance"
        className="mb-6"
      />

      <div className="space-y-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
                  <Badge variant={
                    project.status === 'Completed' ? 'green'
                      : project.status === 'In Progress' ? 'blue'
                      : 'gray'
                  } size="sm">
                    {project.status}
                  </Badge>
                  <Badge variant={
                    project.risk_level === 'High' ? 'red'
                      : project.risk_level === 'Medium' ? 'orange'
                      : 'green'
                  } size="sm">
                    {project.risk_level} Risk
                  </Badge>
                </div>
                <p className="text-gray-600 mb-1">{project.location}</p>
                <p className="text-sm text-gray-500">
                  {format(new Date(project.start_date), 'MMM dd, yyyy')} -&nbsp;
                  {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : 'TBD'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">€{project.budget.toLocaleString('hr-HR')}</p>
                <p className="text-sm text-gray-600">Total Budget</p>
                <Button variant="secondary" size="sm" icon={Eye} onClick={() => setSelectedProject(project)} className="mt-2">
                  View Details
                </Button>
              </div>
            </div>

            <StatGrid columns={4} className="mb-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-700">Equity Investment</span>
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-lg font-bold text-green-900">€{project.total_investment.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-green-600">
                  {project.budget > 0 ? ((project.total_investment / project.budget) * 100).toFixed(1) : '0'}% of budget
                </p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-700">Debt Financing</span>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-lg font-bold text-red-900">€{project.total_debt.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-red-600">
                  {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}% of budget
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700">Expected ROI</span>
                  <Target className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-blue-900">{project.expected_roi.toFixed(1)}%</p>
                <p className="text-xs text-blue-600">Weighted average</p>
              </div>

              <div className="bg-teal-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-teal-700">Funding Status</span>
                  <PieChart className="w-4 h-4 text-teal-600" />
                </div>
                <p className={`text-lg font-bold ${getFundingColor(project.funding_ratio)}`}>
                  {project.funding_ratio.toFixed(1)}%
                </p>
                <p className="text-xs text-teal-600">
                  {project.funding_ratio >= 100 ? 'Fully funded' : 'Needs funding'}
                </p>
              </div>
            </StatGrid>

            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Total Funding Progress</span>
                <span className="text-sm font-medium">{project.funding_ratio.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    project.funding_ratio >= 100 ? 'bg-green-600' :
                    project.funding_ratio >= 80 ? 'bg-blue-600' : 'bg-orange-600'
                  }`}
                  style={{ width: `${Math.min(100, project.funding_ratio)}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Funders</span>
                <Building2 className="w-4 h-4 text-gray-400" />
              </div>
              <div className="space-y-1">
                {project.banks.length === 0 ? (
                  <p className="text-xs text-gray-500">No financing sources</p>
                ) : (
                  project.banks.slice(0, 3).map((bank) => (
                    <p key={bank.id} className="text-xs text-gray-700">• {bank.name}</p>
                  ))
                )}
                {project.banks.length > 3 && (
                  <p className="text-xs text-gray-500">+{project.banks.length - 3} more</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedProject && (
        <InvestmentProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  )
}

export default InvestmentProjects
