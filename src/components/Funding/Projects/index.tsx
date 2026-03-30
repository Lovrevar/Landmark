import React, { useState, useEffect } from 'react'
import {
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Eye,
  PieChart
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner, PageHeader, StatGrid, Badge, Button } from '../../ui'
import { format } from 'date-fns'
import type { ProjectWithFinancials } from '../../General/Projects/types'
import { fetchInvestmentProjects } from './services/investmentService'
import InvestmentProjectModal from './modals/InvestmentProjectModal'

const getFundingColor = (ratio: number) => {
  if (ratio >= 100) return 'text-green-600'
  if (ratio >= 80) return 'text-blue-600'
  return 'text-orange-600'
}

const InvestmentProjects: React.FC = () => {
  const { t } = useTranslation()
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
    return <LoadingSpinner message={t('funding.projects.loading')} />
  }

  return (
    <div>
      <PageHeader
        title={t('funding.projects.title')}
        description={t('funding.projects.description')}
        className="mb-6"
      />

      <div className="space-y-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{project.name}</h3>
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
                    {project.risk_level} {t('funding.projects.risk_label')}
                  </Badge>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">{project.location}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {format(new Date(project.start_date), 'MMM dd, yyyy')} -&nbsp;
                  {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : t('funding.projects.modal.tbd')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">€{project.budget.toLocaleString('hr-HR')}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.total_budget_label')}</p>
                <Button variant="secondary" size="sm" icon={Eye} onClick={() => setSelectedProject(project)} className="mt-2">
                  {t('funding.projects.view_details_button')}
                </Button>
              </div>
            </div>

            <StatGrid columns={4} className="mb-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-700 dark:text-green-400">{t('funding.projects.equity_investment_label')}</span>
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-lg font-bold text-green-900 dark:text-green-300">€{project.total_investment.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-green-600">
                  {project.budget > 0 ? ((project.total_investment / project.budget) * 100).toFixed(1) : '0'}% {t('funding.projects.of_budget')}
                </p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-700 dark:text-red-400">{t('funding.projects.debt_financing_label')}</span>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-lg font-bold text-red-900 dark:text-red-300">€{project.total_debt.toLocaleString('hr-HR')}</p>
                <p className="text-xs text-red-600">
                  {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}% {t('funding.projects.of_budget')}
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700 dark:text-blue-300">{t('funding.projects.expected_roi_label')}</span>
                  <Target className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{project.expected_roi.toFixed(1)}%</p>
                <p className="text-xs text-blue-600">{t('funding.projects.weighted_average')}</p>
              </div>

              <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-teal-700 dark:text-teal-400">{t('funding.projects.funding_status_label')}</span>
                  <PieChart className="w-4 h-4 text-teal-600" />
                </div>
                <p className={`text-lg font-bold ${getFundingColor(project.funding_ratio)}`}>
                  {project.funding_ratio.toFixed(1)}%
                </p>
                <p className="text-xs text-teal-600 dark:text-teal-400">
                  {project.funding_ratio >= 100 ? t('funding.projects.fully_funded') : t('funding.projects.needs_funding')}
                </p>
              </div>
            </StatGrid>

            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('funding.projects.total_funding_progress')}</span>
                <span className="text-sm font-medium">{project.funding_ratio.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    project.funding_ratio >= 100 ? 'bg-green-600' :
                    project.funding_ratio >= 80 ? 'bg-blue-600' : 'bg-orange-600'
                  }`}
                  style={{ width: `${Math.min(100, project.funding_ratio)}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('funding.projects.funders_label')}</span>
                <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="space-y-1">
                {project.banks.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.projects.no_financing_sources')}</p>
                ) : (
                  project.banks.slice(0, 3).map((bank) => (
                    <p key={bank.id} className="text-xs text-gray-700 dark:text-gray-200">• {bank.name}</p>
                  ))
                )}
                {project.banks.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('funding.projects.more_funders', { count: project.banks.length - 3 })}</p>
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
