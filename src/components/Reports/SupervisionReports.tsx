import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  Users,
  Download,
  FileText,
  Activity,
  ClipboardCheck
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { PageHeader, StatGrid, LoadingSpinner, Button, Badge, Select, FormField, Input, Table, StatCard, EmptyState } from '../ui'
import type { Project } from '../../lib/supabase'
import type { ProjectSupervisionReport } from './types'
import { fetchProjects, generateProjectReport } from './services/supervisionReportService'
import { generateSupervisionReportPDF } from './pdf/supervisionReportPdf'
import { useToast } from '../../contexts/ToastContext'

const SupervisionReports: React.FC = () => {
  const toast = useToast()
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projectReport, setProjectReport] = useState<ProjectSupervisionReport | null>(null)
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadProjectReport()
    }
  }, [selectedProject, dateRange])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await fetchProjects()
      setProjects(data)
      if (data.length > 0) {
        setSelectedProject(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjectReport = async () => {
    if (!selectedProject) return
    setGeneratingReport(true)
    try {
      const report = await generateProjectReport(selectedProject, projects, dateRange)
      setProjectReport(report)
    } catch (error) {
      console.error('Error generating project report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleGeneratePDF = async () => {
    if (!projectReport) return
    try {
      await generateSupervisionReportPDF(projectReport, dateRange)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(t('reports.supervision.pdf_error'))
    }
  }

  if (loading) {
    return <LoadingSpinner message={t('reports.supervision.loading')} />
  }

  return (
    <div>
      <PageHeader
        title={t('reports.supervision.title')}
        description={t('reports.supervision.description')}
        actions={
          projectReport ? (
            <Button icon={Download} onClick={handleGeneratePDF}>
              {t('reports.supervision.export_report')}
            </Button>
          ) : undefined
        }
        className="mb-6"
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('reports.supervision.config_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label={t('reports.supervision.project_label')}>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">{t('reports.supervision.select_project')}</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={t('reports.supervision.start_date')}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label={t('reports.supervision.end_date')}>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {generatingReport && (
        <LoadingSpinner message={t('reports.supervision.generating')} />
      )}

      {projectReport && !generatingReport && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reports.supervision.project_overview')}</h2>
              <Badge variant={
                projectReport.project.status === 'Completed' ? 'green'
                  : projectReport.project.status === 'In Progress' ? 'blue'
                  : 'gray'
              }>
                {projectReport.project.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{projectReport.project.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('reports.supervision.location')}</span>
                    <span className="font-medium">{projectReport.project.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('reports.supervision.start_date_label')}</span>
                    <span className="font-medium">{format(new Date(projectReport.project.start_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('reports.supervision.total_budget')}</span>
                    <span className="font-medium">€{projectReport.total_budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('reports.supervision.funders')}</span>
                    <span className="font-medium">{projectReport.investors}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('reports.supervision.budget_performance')}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('reports.supervision.budget_used')}</span>
                    <span className="font-bold text-orange-600">€{projectReport.total_payments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('reports.supervision.remaining')}</span>
                    <span className="font-bold text-green-600">€{projectReport.remaining_budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('reports.supervision.utilization')}</span>
                    <span className="font-medium">{projectReport.total_budget > 0 ? ((projectReport.budget_used / projectReport.total_budget) * 100).toFixed(1) : '0'}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <StatGrid columns={5}>
            <StatCard label={t('reports.supervision.total_contracts_stat')} value={projectReport.total_contracts} icon={FileText} color="blue" />
            <StatCard label={t('reports.supervision.active_contracts_stat')} value={projectReport.active_contracts} icon={TrendingUp} color="green" />
            <StatCard label={t('reports.supervision.subcontractors_stat')} value={projectReport.total_subcontractors} icon={Users} color="teal" />
            <StatCard label={t('reports.supervision.phases_done_stat')} value={`${projectReport.completed_phases}/${projectReport.total_phases}`} icon={Activity} color="orange" />
            <StatCard label={t('reports.supervision.work_logs_stat')} value={projectReport.total_work_logs} icon={ClipboardCheck} color="teal" />
          </StatGrid>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('reports.supervision.contract_status')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
                      <span className="text-gray-700 dark:text-gray-200">Completed</span>
                    </div>
                    <span className="font-semibold">{projectReport.completed_contracts} contracts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
                      <span className="text-gray-700 dark:text-gray-200">Active</span>
                    </div>
                    <span className="font-semibold">{projectReport.active_contracts} contracts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-500 rounded mr-3"></div>
                      <span className="text-gray-700 dark:text-gray-200">Other</span>
                    </div>
                    <span className="font-semibold">{projectReport.total_contracts - projectReport.active_contracts - projectReport.completed_contracts} contracts</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="space-y-3">
                  {[
                    { label: 'Completed', count: projectReport.completed_contracts, color: 'bg-green-500' },
                    { label: 'Active', count: projectReport.active_contracts, color: 'bg-blue-500' }
                  ].map(({ label, count, color }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                        <span className="text-sm font-medium">{projectReport.total_contracts > 0 ? ((count / projectReport.total_contracts) * 100).toFixed(1) : '0'}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className={`${color} h-2 rounded-full`}
                          style={{ width: `${projectReport.total_contracts > 0 ? (count / projectReport.total_contracts) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Monthly Budget Performance</h2>
            <Table>
              <Table.Head>
                <Table.Tr>
                  <Table.Th>Month</Table.Th>
                  <Table.Th>Contracts</Table.Th>
                  <Table.Th>Subcontractors Paid</Table.Th>
                  <Table.Th>Payments</Table.Th>
                </Table.Tr>
              </Table.Head>
              <Table.Body>
                {projectReport.monthly_data.map((month, index) => (
                  <Table.Tr key={index}>
                    <Table.Td className="font-medium text-gray-900 dark:text-white">{month.month}</Table.Td>
                    <Table.Td>{month.contracts}</Table.Td>
                    <Table.Td>{month.subcontractors_paid}</Table.Td>
                    <Table.Td>€{month.payments.toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
              Work Logs ({projectReport.total_work_logs})
            </h2>
            {projectReport.work_logs.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No work logs recorded during this period" />
            ) : (
              <div className="space-y-3">
                {projectReport.work_logs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="border-l-4 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
                    style={{ borderLeftColor: log.color || 'blue' }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{log.subcontractors?.name || 'Unknown'}</h3>
                          <Badge variant="blue" size="sm">{log.status.replace('_', ' ')}</Badge>
                        </div>
                        {log.contracts && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Contract: {log.contracts.contract_number} - {log.contracts.job_description}
                          </p>
                        )}
                        <p className="text-sm text-gray-700 dark:text-gray-200">{log.work_description}</p>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(log.date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    {log.blocker_details && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                        <p className="text-xs font-medium text-red-800 dark:text-red-300">Issue: {log.blocker_details}</p>
                      </div>
                    )}
                    {log.notes && (
                      <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400">{log.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
                {projectReport.work_logs.length > 10 && (
                  <div className="text-center py-3 text-sm text-gray-600 dark:text-gray-400">
                    ... and {projectReport.work_logs.length - 10} more work logs. Full details in PDF export.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Summary & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Performance Highlights</h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                  <li>• {projectReport.budget_used / projectReport.total_budget > 0.9 ? 'High' : projectReport.budget_used / projectReport.total_budget > 0.75 ? 'Moderate' : 'Good'} budget utilization at {projectReport.total_budget > 0 ? ((projectReport.budget_used / projectReport.total_budget) * 100).toFixed(1) : '0'}%</li>
                  <li>• {projectReport.completed_contracts} contracts completed out of {projectReport.total_contracts}</li>
                  <li>• {projectReport.completed_phases} phases completed out of {projectReport.total_phases}</li>
                  <li>• Managing {projectReport.total_subcontractors} subcontractors</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">Recommendations</h3>
                <ul className="space-y-2 text-green-800 dark:text-green-300">
                  {projectReport.budget_used / projectReport.total_budget > 0.9 && <li>• Monitor remaining budget closely</li>}
                  {projectReport.active_contracts > 0 && <li>• Focus on completing active contracts</li>}
                  {projectReport.completed_phases < projectReport.total_phases && <li>• Coordinate phase completion schedules</li>}
                  <li>• Maintain regular communication with subcontractors</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupervisionReports
