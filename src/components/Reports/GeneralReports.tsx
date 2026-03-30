import React, { useState } from 'react'
import {
  Download,
  Building2,
  FileText,
  AlertTriangle,
  Target,
  Activity,
  Wallet,
  CreditCard,
  BarChart3,
  Home
} from 'lucide-react'
import { format } from 'date-fns'
import { LoadingSpinner, Button, Badge, EmptyState, Table } from '../ui'
import { generateGeneralReportPDF } from './pdf/generalReportPdf'
import { useGeneralReportData } from './hooks/useGeneralReportData'
import { useToast } from '../../contexts/ToastContext'
import { useTranslation } from 'react-i18next'

const GeneralReports: React.FC = () => {
  const toast = useToast()
  const { t } = useTranslation()
  const { report, loading } = useGeneralReportData()
  const [generatingPDF, setGeneratingPDF] = useState(false)

  const handleGeneratePDF = async () => {
    if (!report) return
    setGeneratingPDF(true)
    try {
      await generateGeneralReportPDF(report)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(t('reports.general.pdf_error'))
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner size="lg" message={t('reports.general.loading')} className="min-h-screen" />
    )
  }

  if (!report) {
    return <EmptyState icon={FileText} title={t('reports.general.no_data')} />
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('reports.general.landmark_group')}</h1>
            <p className="text-xl font-light mb-1">{t('reports.general.exec_report')}</p>
            <p className="text-sm opacity-90">{t('reports.general.generated')} {format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
          </div>
          <Button
            icon={Download}
            onClick={handleGeneratePDF}
            loading={generatingPDF}
            className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg font-semibold"
          >
            {t('reports.general.export_pdf')}
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/30 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">{t('reports.general.exec_summary')}</h2>
        </div>
        <div className="space-y-2 text-gray-800 dark:text-gray-100">
          <p>• Portfolio: {report.executive_summary.total_projects} projects ({report.executive_summary.active_projects} active, {report.executive_summary.completed_projects} completed)</p>
          <p>• Financial: €{(report.executive_summary.total_revenue / 1000000).toFixed(1)}M revenue, €{(report.executive_summary.total_expenses / 1000000).toFixed(1)}M expenses, €{(report.executive_summary.total_profit / 1000000).toFixed(1)}M profit ({report.executive_summary.profit_margin.toFixed(1)}% margin)</p>
          <p>• Capital Structure: €{(report.funding_structure.total_equity / 1000000).toFixed(1)}M equity, €{(report.funding_structure.total_debt / 1000000).toFixed(1)}M debt, {report.funding_structure.debt_equity_ratio.toFixed(2)} D/E ratio</p>
          <p>• Sales: {report.sales_performance.units_sold}/{report.sales_performance.total_units} units sold ({report.kpis.sales_rate.toFixed(1)}%), {report.sales_performance.total_sales} transactions</p>
          <p>• Construction: {report.construction_status.total_contracts} contracts, {report.construction_status.total_subcontractors} subcontractors, {report.construction_status.work_logs_7days} work logs recorded</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-6">{t('reports.general.kpi_title')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-6 rounded-xl text-center border border-blue-200 dark:border-blue-700">
            <p className="text-3xl font-bold text-blue-600">€{(report.kpis.portfolio_value / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.portfolio_value')}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 p-6 rounded-xl text-center border border-green-200 dark:border-green-700">
            <p className="text-3xl font-bold text-green-600">€{(report.kpis.total_revenue / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.total_revenue')}</p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-900/10 p-6 rounded-xl text-center border border-teal-200 dark:border-teal-700">
            <p className="text-3xl font-bold text-teal-600">€{(report.kpis.net_profit / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.net_profit')}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 p-6 rounded-xl text-center border border-orange-200 dark:border-orange-700">
            <p className="text-3xl font-bold text-orange-600">{report.kpis.roi.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.roi')}</p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-900/10 p-6 rounded-xl text-center border border-teal-200 dark:border-teal-700">
            <p className="text-3xl font-bold text-teal-600">{report.kpis.sales_rate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.sales_rate')}</p>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-900/10 p-6 rounded-xl text-center border border-pink-200 dark:border-pink-700">
            <p className="text-3xl font-bold text-pink-600">{report.kpis.debt_equity_ratio.toFixed(2)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.de_ratio')}</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 p-6 rounded-xl text-center border border-slate-200 dark:border-slate-600">
            <p className="text-3xl font-bold text-slate-600 dark:text-slate-300">{report.kpis.active_projects}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.active_projects')}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 p-6 rounded-xl text-center border border-yellow-200 dark:border-yellow-700">
            <p className="text-3xl font-bold text-yellow-600">{report.kpis.total_customers}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('reports.general.total_customers')}</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-xl shadow-sm border border-green-200 dark:border-green-700 p-6">
        <div className="flex items-center mb-4">
          <Home className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900 dark:text-green-300">{t('reports.general.sales_performance')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.total_units_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.total_units}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.units_sold_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.units_sold} ({((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1)}%)</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.available_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.available_units}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.reserved_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.reserved_units}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.total_revenue_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">€{report.sales_performance.total_revenue.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.avg_sale_price_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">€{report.sales_performance.avg_sale_price.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.total_sales_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.total_sales}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.buyers_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.buyers}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.active_leads_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.active_leads}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.conversion_rate_label')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.sales_performance.conversion_rate.toFixed(1)}%</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-900/10 rounded-xl shadow-sm border border-teal-200 dark:border-teal-700 p-6">
          <div className="flex items-center mb-4">
            <Wallet className="w-6 h-6 text-teal-600 mr-2" />
            <h2 className="text-xl font-bold text-teal-900 dark:text-teal-100">{t('reports.general.funding_structure')}</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              [t('reports.general.total_equity'), `€${report.funding_structure.total_equity.toLocaleString()}`],
              [t('reports.general.total_debt'), `€${report.funding_structure.total_debt.toLocaleString()}`],
              [t('reports.general.de_ratio_label'), report.funding_structure.debt_equity_ratio.toFixed(2)],
              [t('reports.general.total_credit_lines'), `€${report.funding_structure.total_credit_lines.toLocaleString()}`],
              [t('reports.general.available_credit'), `€${report.funding_structure.available_credit.toLocaleString()}`],
              [t('reports.general.active_funders'), report.funding_structure.active_investors.toString()],
              [t('reports.general.active_banks'), report.funding_structure.active_banks.toString()],
              [t('reports.general.bank_credits'), report.funding_structure.bank_credits.toString()],
              [t('reports.general.avg_interest'), `${report.funding_structure.avg_interest_rate.toFixed(2)}%`],
              [t('reports.general.monthly_debt_service'), `€${report.funding_structure.monthly_debt_service.toLocaleString()}`]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <span className="font-bold text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 rounded-xl shadow-sm border border-orange-200 dark:border-orange-700 p-6">
          <div className="flex items-center mb-4">
            <Activity className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-xl font-bold text-orange-900 dark:text-orange-100">{t('reports.general.construction_status')}</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              [t('reports.general.total_contracts'), report.construction_status.total_contracts.toString()],
              [t('reports.general.active_contracts'), report.construction_status.active_contracts.toString()],
              [t('reports.general.completed_contracts'), report.construction_status.completed_contracts.toString()],
              [t('reports.general.contract_value'), `€${report.construction_status.contract_value.toLocaleString()}`],
              [t('reports.general.budget_realized'), `€${report.construction_status.budget_realized.toLocaleString()}`],
              [t('reports.general.budget_utilization'), `${report.construction_status.budget_utilization.toFixed(1)}%`],
              [t('reports.general.total_subcontractors'), report.construction_status.total_subcontractors.toString()],
              [t('reports.general.total_phases'), report.construction_status.total_phases.toString()],
              [t('reports.general.completed_phases'), report.construction_status.completed_phases.toString()],
              [t('reports.general.work_logs_7days'), report.construction_status.work_logs_7days.toString()],
              [t('reports.general.total_milestones'), report.construction_status.total_milestones.toString()],
              [t('reports.general.completed_milestones'), report.construction_status.completed_milestones.toString()]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <span className="font-bold text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/10 rounded-xl shadow-sm border border-cyan-200 dark:border-cyan-700 p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 text-cyan-600 mr-2" />
          <h2 className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{t('reports.general.accounting_overview')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.total_invoices')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.accounting_overview.total_invoices}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.total_invoice_value')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">€{(report.accounting_overview.total_invoice_value / 1000000).toFixed(2)}M</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.paid_invoices')}</p><p className="text-xl font-bold text-green-600">{report.accounting_overview.paid_invoices} (€{(report.accounting_overview.paid_value / 1000000).toFixed(2)}M)</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.pending_invoices')}</p><p className="text-xl font-bold text-yellow-600">{report.accounting_overview.pending_invoices} (€{(report.accounting_overview.pending_value / 1000000).toFixed(2)}M)</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.overdue_invoices')}</p><p className="text-xl font-bold text-red-600">{report.accounting_overview.overdue_invoices} (€{(report.accounting_overview.overdue_value / 1000000).toFixed(2)}M)</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.payment_completion')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.accounting_overview.payment_completion_rate.toFixed(1)}%</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 rounded-xl shadow-sm border border-amber-200 dark:border-amber-700 p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-6 h-6 text-amber-600 mr-2" />
            <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100">{t('reports.general.office_expenses')}</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              [t('reports.general.total_office_suppliers'), report.office_expenses.total_office_suppliers.toString()],
              [t('reports.general.total_office_invoices'), report.office_expenses.total_office_invoices.toString()],
              [t('reports.general.total_office_spent'), `€${report.office_expenses.total_office_spent.toLocaleString()}`],
              [t('reports.general.avg_office_invoice'), `€${report.office_expenses.avg_office_invoice.toLocaleString()}`]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <span className="font-bold text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-900/10 rounded-xl shadow-sm border border-rose-200 dark:border-rose-700 p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="w-6 h-6 text-rose-600 mr-2" />
            <h2 className="text-xl font-bold text-rose-900 dark:text-rose-100">{t('reports.general.company_investments')}</h2>
          </div>
          <div className="space-y-3 text-sm">
            {([
              [t('reports.general.total_investments_label'), report.company_credits.total_credits.toString(), false],
              [t('reports.general.total_investment_value'), `€${report.company_credits.total_credit_value.toLocaleString()}`, false],
              [t('reports.general.available_inv'), `€${report.company_credits.credits_available.toLocaleString()}`, true],
              [t('reports.general.used_inv'), `€${report.company_credits.credits_used.toLocaleString()}`, false],
              [t('reports.general.cesija_payments'), report.company_credits.cesija_payments.toString(), false],
              [t('reports.general.cesija_value'), `€${report.company_credits.cesija_value.toLocaleString()}`, false],
              [t('reports.general.investment_allocations'), report.company_credits.total_allocations.toString(), false],
              [t('reports.general.total_allocated'), `€${report.company_credits.allocated_amount.toLocaleString()}`, false]
            ] as [string, string, boolean][]).map(([label, value, isGreen], i) => (
              <div key={i} className="flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <span className={`font-bold ${isGreen ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 p-6">
          <div className="flex items-center mb-4">
            <Wallet className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-2" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('reports.general.bank_accounts')}</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.total_bank_accounts')}</span><span className="font-bold text-gray-900 dark:text-white">{report.bank_accounts.total_accounts}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.total_balance')}</span><span className={`font-bold ${report.bank_accounts.total_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>€{report.bank_accounts.total_balance.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.positive_accounts')}</span><span className="font-bold text-green-600">{report.bank_accounts.positive_balance_accounts}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.negative_accounts')}</span><span className="font-bold text-red-600">{report.bank_accounts.negative_balance_accounts}</span></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-900/10 rounded-xl shadow-sm border border-teal-200 dark:border-teal-700 p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-6 h-6 text-teal-600 mr-2" />
            <h2 className="text-xl font-bold text-teal-900 dark:text-teal-100">{t('reports.general.buildings_units')}</h2>
          </div>
          <div className="space-y-3 text-sm">
            {([
              [t('reports.general.total_buildings'), report.buildings_units.total_buildings.toString(), 'normal'],
              [t('reports.general.total_units_label2'), report.buildings_units.total_units.toString(), 'normal'],
              [t('reports.general.sold_units'), report.buildings_units.sold_units.toString(), 'green'],
              [t('reports.general.reserved_units'), report.buildings_units.reserved_units.toString(), 'yellow'],
              [t('reports.general.available_units'), report.buildings_units.available_units.toString(), 'normal'],
              [t('reports.general.garages'), report.buildings_units.total_garages.toString(), 'normal'],
              [t('reports.general.repositories'), report.buildings_units.total_repositories.toString(), 'normal']
            ] as [string, string, string][]).map(([label, value, color], i) => (
              <div key={i} className="flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <span className={`font-bold ${color === 'green' ? 'text-green-600' : color === 'yellow' ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-xl shadow-sm border border-green-200 dark:border-green-700 p-6">
        <div className="flex items-center mb-4">
          <Home className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900 dark:text-green-300">{t('reports.general.retail_portfolio')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.retail_projects')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.total_retail_projects}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.active_retail_projects')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.active_retail_projects}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.land_plots')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.total_land_plots}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.retail_contracts')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.total_retail_contracts}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.contract_value_retail')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">€{report.retail_portfolio.retail_contract_value.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.budget_realized_retail')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">€{report.retail_portfolio.retail_budget_realized.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.retail_phases')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.retail_phases}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.completed_retail_phases')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.completed_retail_phases}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.retail_customers')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.total_retail_customers}</p></div>
          <div><p className="font-bold text-gray-700 dark:text-gray-200">{t('reports.general.retail_suppliers')}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{report.retail_portfolio.retail_suppliers}</p></div>
        </div>
      </div>

      {report.contract_types.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center mb-4">
            <FileText className="w-6 h-6 text-gray-600 dark:text-gray-400 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.general.contract_types')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {report.contract_types.map((ct, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="font-bold text-gray-700 dark:text-gray-200 text-sm">{ct.name}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{ct.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.general.cash_flow')}</h2>
        </div>
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>{t('reports.general.month_col')}</Table.Th>
              <Table.Th>{t('reports.general.inflow_col')}</Table.Th>
              <Table.Th>{t('reports.general.outflow_col')}</Table.Th>
              <Table.Th>{t('reports.general.net_col')}</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {report.cash_flow.map((month, index) => (
              <Table.Tr key={index}>
                <Table.Td className="font-medium text-gray-900 dark:text-white">{month.month}</Table.Td>
                <Table.Td>€{(month.inflow / 1000).toFixed(0)}K</Table.Td>
                <Table.Td>€{(month.outflow / 1000).toFixed(0)}K</Table.Td>
                <Table.Td className={`font-bold ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  €{(month.net / 1000).toFixed(0)}K
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="font-bold text-gray-900 dark:text-white">{t('reports.general.six_month_totals')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {t('reports.general.inflow_col')}: €{(report.cash_flow.reduce((sum, m) => sum + m.inflow, 0) / 1000000).toFixed(2)}M |
            {t('reports.general.outflow_col')}: €{(report.cash_flow.reduce((sum, m) => sum + m.outflow, 0) / 1000000).toFixed(2)}M |
            {t('reports.general.net_col')}: €{(report.cash_flow.reduce((sum, m) => sum + m.net, 0) / 1000000).toFixed(2)}M
          </p>
        </div>
      </div>

      {report.projects.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('reports.general.project_breakdown')}</h2>
          <div className="space-y-4">
            {report.projects.map((project) => (
              <div key={project.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{project.location}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={project.risk_level === 'High' ? 'red' : project.risk_level === 'Medium' ? 'yellow' : 'green'}>
                      {t('reports.general.risk')} {project.risk_level}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.status_label')}</p><p className="font-bold text-gray-900 dark:text-white">{project.status}</p></div>
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.budget_label')}</p><p className="font-bold text-gray-900 dark:text-white">€{project.budget.toLocaleString()}</p></div>
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.revenue_label')}</p><p className="font-bold text-green-600">€{project.revenue.toLocaleString()}</p></div>
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.expenses_label')}</p><p className="font-bold text-red-600">€{project.expenses.toLocaleString()}</p></div>
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.units_label')}</p><p className="font-bold text-gray-900 dark:text-white">{project.units_sold}/{project.total_units} sold ({project.sales_rate.toFixed(1)}%)</p></div>
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.contracts_label')}</p><p className="font-bold text-gray-900 dark:text-white">{project.contracts}</p></div>
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.phases_label')}</p><p className="font-bold text-gray-900 dark:text-white">{project.phases_done}/{project.total_phases} done</p></div>
                  <div><p className="text-gray-600 dark:text-gray-400">{t('reports.general.funding_label')}</p><p className="font-bold text-gray-900 dark:text-white">€{project.equity.toLocaleString()} equity, €{project.debt.toLocaleString()} debt</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.risks.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-300">{t('reports.general.risk_assessment')}</h2>
          </div>
          <ul className="space-y-2">
            {report.risks.map((risk, index) => (
              <li key={index} className="flex items-start">
                <span className="text-red-600 mr-2">•</span>
                <span className="text-gray-800 dark:text-gray-100"><strong>{risk.type}:</strong> {risk.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-xl shadow-sm border border-green-200 dark:border-green-700 p-6">
        <div className="flex items-center mb-4">
          <Target className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900 dark:text-green-300">{t('reports.general.insights')}</h2>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t('reports.general.top_projects')}</h3>
          <ul className="space-y-2">
            {report.insights.top_projects.map((project, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2">-</span>
                <span className="text-gray-800 dark:text-gray-100">{project.name}: €{(project.revenue / 1000000).toFixed(1)}M revenue, {project.sales_rate.toFixed(1)}% sales rate</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t('reports.general.recommendations')}</h3>
          <ul className="space-y-2">
            {report.insights.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2">•</span>
                <span className="text-gray-800 dark:text-gray-100">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default GeneralReports
