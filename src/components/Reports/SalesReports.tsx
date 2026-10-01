import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCachedData } from '../../lib/useCachedData'
import { useAsyncExport } from '../../hooks/useAsyncExport'
import type { Project } from '../../lib/supabase'
import {
  TrendingUp,
  Euro,
  Home,
  Users,
  Download,
  Activity
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { PageHeader, StatGrid, LoadingSpinner, Button, Badge, Select, FormField, Input, Table, StatCard, ErrorState } from '../ui'
import {
  fetchProjects,
  generateProjectReport,
  generateCustomerReport
} from './services/salesReportService'
import { generateSalesReportPDF } from './pdf/salesReportPdf'
import type { ProjectSalesReport, CustomerReport } from './types'
import { formatEuro, formatEuroCompact, formatDate, formatMonthYear } from '../../utils/formatters'
import { PROJECT_STATUS, statusLabel, statusVariant } from '../../utils/statusDisplay'

const SalesReports: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [reportType, setReportType] = useState<'project' | 'customer'>('project')
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [loading, setLoading] = useState(true)

  const {
    data: projectReport,
    loading: loadingProjectReport,
    error: projectReportError,
    refetch: refetchProjectReport
  } = useCachedData<ProjectSalesReport>(
    `report:sales:project:${selectedProject}:${dateRange.start}:${dateRange.end}`,
    () => generateProjectReport(selectedProject, projects, dateRange),
    { enabled: reportType === 'project' && !!selectedProject && projects.length > 0 }
  )

  const {
    data: customerReport,
    loading: loadingCustomerReport,
    error: customerReportError,
    refetch: refetchCustomerReport
  } = useCachedData<CustomerReport>(
    `report:sales:customer:${dateRange.start}:${dateRange.end}`,
    () => generateCustomerReport(dateRange),
    { enabled: reportType === 'customer' }
  )

  const generatingReport = reportType === 'project' ? loadingProjectReport : loadingCustomerReport

  // Both report types are rendered by the same page, so the error belongs to whichever one the
  // user is looking at. Without this the page simply showed nothing below the filters — the
  // configuration panel stayed, and a failed report looked like a report not requested yet.
  const reportError = reportType === 'project' ? projectReportError : customerReportError
  const currentReport = reportType === 'project' ? projectReport : customerReport
  const retryReport = reportType === 'project' ? refetchProjectReport : refetchCustomerReport

  useEffect(() => {
    loadProjects()
  }, [])

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

  // One export path for the whole app: `useAsyncExport` owns the try/catch, the console line and
  // the toast, so a font that failed to load surfaces as a message instead of a silent no-op.
  const { exporting, run: runExportPDF } = useAsyncExport(
    () => generateSalesReportPDF(reportType, projectReport, customerReport, dateRange),
    'reports.sales.pdf_error'
  )

  const handleGeneratePDF = () => {
    if (reportType === 'project' && !projectReport) return
    if (reportType === 'customer' && !customerReport) return
    runExportPDF()
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
            <Button icon={Download} onClick={handleGeneratePDF} disabled={exporting}>
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

      {!generatingReport && reportError && !currentReport && (
        <ErrorState onRetry={retryReport} />
      )}

      {/* Project Report */}
      {reportType === 'project' && projectReport && !generatingReport && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reports.sales.project_overview')}</h2>
              <Badge variant={statusVariant(PROJECT_STATUS, projectReport.project.status)}>
                {statusLabel(PROJECT_STATUS, projectReport.project.status, t)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{projectReport.project.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.location')}</span><span className="font-medium text-gray-900 dark:text-white">{projectReport.project.location}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.start_date_label')}</span><span className="font-medium text-gray-900 dark:text-white">{formatDate(projectReport.project.start_date, i18n.language)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.budget')}</span><span className="font-medium text-gray-900 dark:text-white">{formatEuro(projectReport.project.budget)}</span></div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('reports.sales.sales_performance')}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.sales_rate_label')}</span><span className="font-bold text-green-600">{projectReport.sales_rate.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.total_revenue')}</span><span className="font-bold text-blue-600">{formatEuro(projectReport.total_revenue)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.average_price')}</span><span className="font-medium text-gray-900 dark:text-white">{formatEuro(projectReport.average_price)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{t('reports.sales.units_sold_label')}</span><span className="font-medium text-gray-900 dark:text-white">{projectReport.sold_units} / {projectReport.total_units}</span></div>
                </div>
              </div>
            </div>
          </div>

          <StatGrid columns={4}>
            <StatCard label={t('reports.sales.total_units_stat')} value={projectReport.total_units} icon={Home} color="blue" />
            <StatCard label={t('reports.sales.units_sold_stat')} value={projectReport.sold_units} icon={TrendingUp} color="green" />
            <StatCard label={t('reports.sales.total_revenue_stat')} value={formatEuroCompact(projectReport.total_revenue)} icon={Euro} color="teal" />
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
                      <span className="font-semibold text-gray-900 dark:text-white">{count} {t('reports.sales.units_label')}</span>
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
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{((count / projectReport.total_units) * 100).toFixed(1)}%</span>
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
                    <Table.Td label={t('reports.sales.month_col')} className="font-medium text-gray-900 dark:text-white">{formatMonthYear(month.month_key, i18n.language)}</Table.Td>
                    <Table.Td label={t('reports.sales.units_sold_col')}>{month.units_sold}</Table.Td>
                    <Table.Td label={t('reports.sales.revenue_col')}>€{month.revenue.toLocaleString('hr-HR')}</Table.Td>
                    <Table.Td label={t('reports.sales.avg_price_col')}>€{month.units_sold > 0 ? (month.revenue / month.units_sold).toLocaleString('hr-HR') : '0'}</Table.Td>
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
                  <li>• {t('reports.sales.highlight_performance', {
                    rating: projectReport.sales_rate > 70 ? t('reports.sales.excellent') : projectReport.sales_rate > 50 ? t('reports.sales.good') : t('reports.sales.needs_improvement'),
                    rate: projectReport.sales_rate.toFixed(1)
                  })}</li>
                  <li>• {t('reports.sales.highlight_revenue', { amount: formatEuro(projectReport.total_revenue) })}</li>
                  <li>• {t('reports.sales.highlight_avg_price', { amount: formatEuro(projectReport.average_price) })}</li>
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
            <StatCard label={t('reports.sales.total_revenue_stat')} value={formatEuroCompact(customerReport.total_revenue)} icon={Euro} color="teal" />
            <StatCard label={t('reports.sales.avg_purchase_stat')} value={formatEuro(customerReport.average_purchase)} icon={Activity} color="orange" />
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
                      <span className="font-semibold text-gray-900 dark:text-white">{count} {t('reports.sales.customers_label')}</span>
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
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{customerReport.total_customers > 0 ? ((count / customerReport.total_customers) * 100).toFixed(1) : '0'}%</span>
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
                  <li>• {t('reports.sales.highlight_total_customers', { count: customerReport.total_customers })}</li>
                  <li>• {t('reports.sales.highlight_conversions', { count: customerReport.buyers })}</li>
                  <li>• {t('reports.sales.highlight_conversion_rate', { rate: customerReport.total_customers > 0 ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1) : '0' })}</li>
                  <li>• {t('reports.sales.highlight_avg_purchase', { amount: formatEuro(customerReport.average_purchase) })}</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">{t('reports.sales.sales_opportunities')}</h3>
                <ul className="space-y-2 text-green-800 dark:text-green-300">
                  <li>• {t('reports.sales.opportunity_interested', { count: customerReport.interested })}</li>
                  <li>• {t('reports.sales.opportunity_leads', { count: customerReport.leads })}</li>
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
