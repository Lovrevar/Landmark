import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../../lib/supabase'
import {
  TrendingUp,
  DollarSign,
  Home,
  Users,
  Download,
  Activity
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { PageHeader, StatGrid, LoadingSpinner, Button, Badge, Select, FormField, Input, Table, StatCard } from '../ui'
import {
  fetchProjects,
  generateProjectReport,
  generateCustomerReport
} from './services/salesReportService'
import { generateSalesReportPDF } from './pdf/salesReportPdf'
import type { ProjectSalesReport, CustomerReport } from './types'
import { useToast } from '../../contexts/ToastContext'

const SalesReports: React.FC = () => {
  const toast = useToast()
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [reportType, setReportType] = useState<'project' | 'customer'>('project')
  const [projectReport, setProjectReport] = useState<ProjectSalesReport | null>(null)
  const [customerReport, setCustomerReport] = useState<CustomerReport | null>(null)
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
    if (reportType === 'project' && selectedProject) {
      loadProjectReport()
    } else if (reportType === 'customer') {
      loadCustomerReport()
    }
  }, [selectedProject, dateRange, reportType])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await fetchProjects()
      setProjects(data)
      if (data.length > 0) setSelectedProject(data[0].id)
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

  const loadCustomerReport = async () => {
    setGeneratingReport(true)
    try {
      const report = await generateCustomerReport(dateRange)
      setCustomerReport(report)
    } catch (error) {
      console.error('Error generating customer report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleGeneratePDF = async () => {
    if (reportType === 'project' && !projectReport) return
    if (reportType === 'customer' && !customerReport) return
    try {
      await generateSalesReportPDF(reportType, projectReport, customerReport, dateRange)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(t('reports.sales.pdf_error'))
    }
  }

  if (loading) {
    return <LoadingSpinner message={t('reports.sales.loading')} />
  }

  return (
    <div>
      <PageHeader
        title={t('reports.sales.title')}
        description={t('reports.sales.description')}
        actions={
          (projectReport || customerReport) ? (
            <Button icon={Download} onClick={handleGeneratePDF}>
              {t('reports.sales.export_report')}
            </Button>
          ) : undefined
        }
        className="mb-6"
      />

      {/* Report Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('reports.sales.config_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField label={t('reports.sales.report_type')}>
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'project' | 'customer')}
            >
              <option value="project">{t('reports.sales.project_sales_report')}</option>
              <option value="customer">{t('reports.sales.customer_report')}</option>
            </Select>
          </FormField>

          {reportType === 'project' && (
            <FormField label={t('reports.sales.project_label')}>
              <Select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">{t('reports.sales.select_project')}</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label={t('reports.sales.start_date')}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label={t('reports.sales.end_date')}>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {generatingReport && (
        <LoadingSpinner message={t('reports.sales.generating')} />
      )}

      {/* Project Report */}
      {reportType === 'project' && projectReport && !generatingReport && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reports.sales.project_overview')}</h2>
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
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.location')}</span><span className="font-medium">{projectReport.project.location}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.start_date_label')}</span><span className="font-medium">{format(new Date(projectReport.project.start_date), 'MMM dd, yyyy')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.budget')}</span><span className="font-medium">${projectReport.project.budget.toLocaleString('hr-HR')}</span></div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('reports.sales.sales_performance')}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.sales_rate_label')}</span><span className="font-bold text-green-600">{projectReport.sales_rate.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.total_revenue')}</span><span className="font-bold text-blue-600">${projectReport.total_revenue.toLocaleString('hr-HR')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.average_price')}</span><span className="font-medium">${projectReport.average_price.toLocaleString('hr-HR')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.units_sold_label')}</span><span className="font-medium">{projectReport.sold_units} / {projectReport.total_units}</span></div>
                </div>
              </div>
            </div>
          </div>

          <StatGrid columns={4}>
            <StatCard label={t('reports.sales.total_units_stat')} value={projectReport.total_units} icon={Home} color="blue" />
            <StatCard label={t('reports.sales.units_sold_stat')} value={projectReport.sold_units} icon={TrendingUp} color="green" />
            <StatCard label={t('reports.sales.total_revenue_stat')} value={`$${(projectReport.total_revenue / 1000000).toFixed(1)}M`} icon={DollarSign} color="teal" />
            <StatCard label={t('reports.sales.sales_rate_stat')} value={`${projectReport.sales_rate.toFixed(1)}%`} icon={Activity} color="orange" />
          </StatGrid>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('reports.sales.unit_status')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  {[
                    { labelKey: 'reports.sales.sold', color: 'bg-green-500', count: projectReport.sold_units },
                    { labelKey: 'reports.sales.available', color: 'bg-blue-500', count: projectReport.available_units },
                    { labelKey: 'reports.sales.reserved', color: 'bg-yellow-500', count: projectReport.reserved_units }
                  ].map(({ labelKey, color, count }) => (
                    <div key={labelKey} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 ${color} rounded mr-3`}></div>
                        <span className="text-gray-700 dark:text-gray-200">{t(labelKey)}</span>
                      </div>
                      <span className="font-semibold">{count} {t('reports.sales.units_label')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="space-y-3">
                  {[
                    { labelKey: 'reports.sales.sold', color: 'bg-green-500', count: projectReport.sold_units },
                    { labelKey: 'reports.sales.available', color: 'bg-blue-500', count: projectReport.available_units },
                    { labelKey: 'reports.sales.reserved', color: 'bg-yellow-500', count: projectReport.reserved_units }
                  ].map(({ labelKey, color, count }) => (
                    <div key={labelKey}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t(labelKey)}</span>
                        <span className="text-sm font-medium">{((count / projectReport.total_units) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${(count / projectReport.total_units) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('reports.sales.monthly_trend')}</h2>
            <Table>
              <Table.Head>
                <Table.Tr>
                  <Table.Th>{t('reports.sales.month_col')}</Table.Th>
                  <Table.Th>{t('reports.sales.units_sold_col')}</Table.Th>
                  <Table.Th>{t('reports.sales.revenue_col')}</Table.Th>
                  <Table.Th>{t('reports.sales.avg_price_col')}</Table.Th>
                </Table.Tr>
              </Table.Head>
              <Table.Body>
                {projectReport.monthly_sales.map((month, index) => (
                  <Table.Tr key={index}>
                    <Table.Td className="font-medium text-gray-900 dark:text-white">{month.month}</Table.Td>
                    <Table.Td>{month.units_sold}</Table.Td>
                    <Table.Td>€{month.revenue.toLocaleString('hr-HR')}</Table.Td>
                    <Table.Td>€{month.units_sold > 0 ? (month.revenue / month.units_sold).toLocaleString('hr-HR') : '0'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('reports.sales.summary')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">{t('reports.sales.performance_highlights')}</h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                  <li>• {projectReport.sales_rate > 70 ? t('reports.sales.excellent') : projectReport.sales_rate > 50 ? t('reports.sales.good') : t('reports.sales.needs_improvement')} sales performance at {projectReport.sales_rate.toFixed(1)}%</li>
                  <li>• Generated €{projectReport.total_revenue.toLocaleString('hr-HR')} in total revenue</li>
                  <li>• Average unit price of €{projectReport.average_price.toLocaleString('hr-HR')}</li>
                  <li>• {t('reports.sales.units_available', { count: projectReport.available_units })}</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">{t('reports.sales.recommendations')}</h3>
                <ul className="space-y-2 text-green-800 dark:text-green-300">
                  {projectReport.sales_rate < 50 && <li>• {t('reports.sales.rec_marketing')}</li>}
                  {projectReport.available_units > projectReport.sold_units && <li>• {t('reports.sales.rec_convert')}</li>}
                  {projectReport.reserved_units > 0 && <li>• {t('reports.sales.rec_reserved')}</li>}
                  <li>• {t('reports.sales.rec_patterns')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Report */}
      {reportType === 'customer' && customerReport && !generatingReport && (
        <div className="space-y-6">
          <StatGrid columns={4}>
            <StatCard label={t('reports.sales.total_customers_stat')} value={customerReport.total_customers} icon={Users} color="blue" />
            <StatCard label={t('reports.sales.buyers_stat')} value={customerReport.buyers} icon={TrendingUp} color="green" />
            <StatCard label={t('reports.sales.total_revenue_stat')} value={`$${(customerReport.total_revenue / 1000000).toFixed(1)}M`} icon={DollarSign} color="teal" />
            <StatCard label={t('reports.sales.avg_purchase_stat')} value={`$${customerReport.average_purchase.toLocaleString()}`} icon={Activity} color="orange" />
          </StatGrid>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('reports.sales.customer_distribution')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  {[
                    { labelKey: 'reports.sales.buyers_label', color: 'bg-green-500', count: customerReport.buyers },
                    { labelKey: 'reports.sales.interested_label', color: 'bg-blue-500', count: customerReport.interested },
                    { labelKey: 'reports.sales.leads_label', color: 'bg-yellow-500', count: customerReport.leads }
                  ].map(({ labelKey, color, count }) => (
                    <div key={labelKey} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 ${color} rounded mr-3`}></div>
                        <span className="text-gray-700 dark:text-gray-200">{t(labelKey)}</span>
                      </div>
                      <span className="font-semibold">{count} {t('reports.sales.customers_label')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="space-y-3">
                  {[
                    { labelKey: 'reports.sales.buyers_label', color: 'bg-green-500', count: customerReport.buyers },
                    { labelKey: 'reports.sales.interested_label', color: 'bg-blue-500', count: customerReport.interested },
                    { labelKey: 'reports.sales.leads_label', color: 'bg-yellow-500', count: customerReport.leads }
                  ].map(({ labelKey, color, count }) => (
                    <div key={labelKey}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t(labelKey)}</span>
                        <span className="text-sm font-medium">{customerReport.total_customers > 0 ? ((count / customerReport.total_customers) * 100).toFixed(1) : '0'}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${customerReport.total_customers > 0 ? (count / customerReport.total_customers) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t('reports.sales.customer_summary')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">{t('reports.sales.customer_highlights')}</h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                  <li>• {customerReport.total_customers} total customers in database</li>
                  <li>• {customerReport.buyers} successful conversions to buyers</li>
                  <li>• {customerReport.total_customers > 0 ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1) : '0'}% conversion rate</li>
                  <li>• ${customerReport.average_purchase.toLocaleString()} average purchase value</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">{t('reports.sales.sales_opportunities')}</h3>
                <ul className="space-y-2 text-green-800 dark:text-green-300">
                  <li>• {customerReport.interested} interested customers to nurture</li>
                  <li>• {customerReport.leads} new leads to follow up</li>
                  <li>• {t('reports.sales.focus_converting')}</li>
                  <li>• {t('reports.sales.targeted_campaigns')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesReports
