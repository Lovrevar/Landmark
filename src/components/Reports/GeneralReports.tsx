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

const GeneralReports: React.FC = () => {
  const toast = useToast()
  const { report, loading } = useGeneralReportData()
  const [generatingPDF, setGeneratingPDF] = useState(false)

  const handleGeneratePDF = async () => {
    if (!report) return
    setGeneratingPDF(true)
    try {
      await generateGeneralReportPDF(report)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner size="lg" message="Generating comprehensive report..." className="min-h-screen" />
    )
  }

  if (!report) {
    return <EmptyState icon={FileText} title="No data available for report generation" />
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">LANDMARK GROUP</h1>
            <p className="text-xl font-light mb-1">Comprehensive Executive Report</p>
            <p className="text-sm opacity-90">Generated: {format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
          </div>
          <Button
            icon={Download}
            onClick={handleGeneratePDF}
            loading={generatingPDF}
            className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-blue-900">EXECUTIVE SUMMARY</h2>
        </div>
        <div className="space-y-2 text-gray-800">
          <p>• Portfolio: {report.executive_summary.total_projects} projects ({report.executive_summary.active_projects} active, {report.executive_summary.completed_projects} completed)</p>
          <p>• Financial: €{(report.executive_summary.total_revenue / 1000000).toFixed(1)}M revenue, €{(report.executive_summary.total_expenses / 1000000).toFixed(1)}M expenses, €{(report.executive_summary.total_profit / 1000000).toFixed(1)}M profit ({report.executive_summary.profit_margin.toFixed(1)}% margin)</p>
          <p>• Capital Structure: €{(report.funding_structure.total_equity / 1000000).toFixed(1)}M equity, €{(report.funding_structure.total_debt / 1000000).toFixed(1)}M debt, {report.funding_structure.debt_equity_ratio.toFixed(2)} D/E ratio</p>
          <p>• Sales: {report.sales_performance.units_sold}/{report.sales_performance.total_units} units sold ({report.kpis.sales_rate.toFixed(1)}%), {report.sales_performance.total_sales} transactions</p>
          <p>• Construction: {report.construction_status.total_contracts} contracts, {report.construction_status.total_subcontractors} subcontractors, {report.construction_status.work_logs_7days} work logs recorded</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-blue-900 mb-6">KEY PERFORMANCE INDICATORS</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl text-center border border-blue-200">
            <p className="text-3xl font-bold text-blue-600">€{(report.kpis.portfolio_value / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 mt-2">Portfolio Value</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl text-center border border-green-200">
            <p className="text-3xl font-bold text-green-600">€{(report.kpis.total_revenue / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 mt-2">Total Revenue</p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl text-center border border-teal-200">
            <p className="text-3xl font-bold text-teal-600">€{(report.kpis.net_profit / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 mt-2">Net Profit</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl text-center border border-orange-200">
            <p className="text-3xl font-bold text-orange-600">{report.kpis.roi.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 mt-2">ROI</p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl text-center border border-teal-200">
            <p className="text-3xl font-bold text-teal-600">{report.kpis.sales_rate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 mt-2">Sales Rate</p>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl text-center border border-pink-200">
            <p className="text-3xl font-bold text-pink-600">{report.kpis.debt_equity_ratio.toFixed(2)}</p>
            <p className="text-sm text-gray-600 mt-2">D/E Ratio</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl text-center border border-slate-200">
            <p className="text-3xl font-bold text-slate-600">{report.kpis.active_projects}</p>
            <p className="text-sm text-gray-600 mt-2">Active Projects</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl text-center border border-yellow-200">
            <p className="text-3xl font-bold text-yellow-600">{report.kpis.total_customers}</p>
            <p className="text-sm text-gray-600 mt-2">Total Customers</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
        <div className="flex items-center mb-4">
          <Home className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900">SALES PERFORMANCE</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div><p className="font-bold text-gray-700">Total Units:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.total_units}</p></div>
          <div><p className="font-bold text-gray-700">Units Sold:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.units_sold} ({((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1)}%)</p></div>
          <div><p className="font-bold text-gray-700">Available:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.available_units}</p></div>
          <div><p className="font-bold text-gray-700">Reserved:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.reserved_units}</p></div>
          <div><p className="font-bold text-gray-700">Total Revenue:</p><p className="text-xl font-bold text-gray-900">€{report.sales_performance.total_revenue.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700">Avg Sale Price:</p><p className="text-xl font-bold text-gray-900">€{report.sales_performance.avg_sale_price.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700">Total Sales:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.total_sales}</p></div>
          <div><p className="font-bold text-gray-700">Buyers:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.buyers}</p></div>
          <div><p className="font-bold text-gray-700">Active Leads:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.active_leads}</p></div>
          <div><p className="font-bold text-gray-700">Conversion Rate:</p><p className="text-xl font-bold text-gray-900">{report.sales_performance.conversion_rate.toFixed(1)}%</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-sm border border-teal-200 p-6">
          <div className="flex items-center mb-4">
            <Wallet className="w-6 h-6 text-teal-600 mr-2" />
            <h2 className="text-xl font-bold text-teal-900">FUNDING & FINANCIAL STRUCTURE</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Total Equity Invested:', `€${report.funding_structure.total_equity.toLocaleString()}`],
              ['Total Debt:', `€${report.funding_structure.total_debt.toLocaleString()}`],
              ['Debt-to-Equity Ratio:', report.funding_structure.debt_equity_ratio.toFixed(2)],
              ['Total Credit Lines:', `€${report.funding_structure.total_credit_lines.toLocaleString()}`],
              ['Available Credit:', `€${report.funding_structure.available_credit.toLocaleString()}`],
              ['Active Funders:', report.funding_structure.active_investors.toString()],
              ['Active Banks:', report.funding_structure.active_banks.toString()],
              ['Bank Credits:', report.funding_structure.bank_credits.toString()],
              ['Avg Interest Rate:', `${report.funding_structure.avg_interest_rate.toFixed(2)}%`],
              ['Monthly Debt Service:', `€${report.funding_structure.monthly_debt_service.toLocaleString()}`]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="font-bold text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border border-orange-200 p-6">
          <div className="flex items-center mb-4">
            <Activity className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-xl font-bold text-orange-900">CONSTRUCTION & SUPERVISION STATUS</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Total Contracts:', report.construction_status.total_contracts.toString()],
              ['Active Contracts:', report.construction_status.active_contracts.toString()],
              ['Completed Contracts:', report.construction_status.completed_contracts.toString()],
              ['Contract Value:', `€${report.construction_status.contract_value.toLocaleString()}`],
              ['Budget Realized:', `€${report.construction_status.budget_realized.toLocaleString()}`],
              ['Budget Utilization:', `${report.construction_status.budget_utilization.toFixed(1)}%`],
              ['Total Subcontractors:', report.construction_status.total_subcontractors.toString()],
              ['Total Phases:', report.construction_status.total_phases.toString()],
              ['Completed Phases:', report.construction_status.completed_phases.toString()],
              ['Work Logs (7 days):', report.construction_status.work_logs_7days.toString()],
              ['Total Milestones:', report.construction_status.total_milestones.toString()],
              ['Completed Milestones:', report.construction_status.completed_milestones.toString()]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="font-bold text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl shadow-sm border border-cyan-200 p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 text-cyan-600 mr-2" />
          <h2 className="text-2xl font-bold text-cyan-900">ACCOUNTING OVERVIEW</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="font-bold text-gray-700">Total Invoices:</p><p className="text-xl font-bold text-gray-900">{report.accounting_overview.total_invoices}</p></div>
          <div><p className="font-bold text-gray-700">Total Invoice Value:</p><p className="text-xl font-bold text-gray-900">€{(report.accounting_overview.total_invoice_value / 1000000).toFixed(2)}M</p></div>
          <div><p className="font-bold text-gray-700">Paid Invoices:</p><p className="text-xl font-bold text-green-600">{report.accounting_overview.paid_invoices} (€{(report.accounting_overview.paid_value / 1000000).toFixed(2)}M)</p></div>
          <div><p className="font-bold text-gray-700">Pending Invoices:</p><p className="text-xl font-bold text-yellow-600">{report.accounting_overview.pending_invoices} (€{(report.accounting_overview.pending_value / 1000000).toFixed(2)}M)</p></div>
          <div><p className="font-bold text-gray-700">Overdue Invoices:</p><p className="text-xl font-bold text-red-600">{report.accounting_overview.overdue_invoices} (€{(report.accounting_overview.overdue_value / 1000000).toFixed(2)}M)</p></div>
          <div><p className="font-bold text-gray-700">Payment Completion Rate:</p><p className="text-xl font-bold text-gray-900">{report.accounting_overview.payment_completion_rate.toFixed(1)}%</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl shadow-sm border border-amber-200 p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-6 h-6 text-amber-600 mr-2" />
            <h2 className="text-xl font-bold text-amber-900">OFFICE EXPENSES</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Total Office Suppliers:', report.office_expenses.total_office_suppliers.toString()],
              ['Total Office Invoices:', report.office_expenses.total_office_invoices.toString()],
              ['Total Office Spent:', `€${report.office_expenses.total_office_spent.toLocaleString()}`],
              ['Avg Office Invoice:', `€${report.office_expenses.avg_office_invoice.toLocaleString()}`]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="font-bold text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl shadow-sm border border-rose-200 p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="w-6 h-6 text-rose-600 mr-2" />
            <h2 className="text-xl font-bold text-rose-900">COMPANY INVESTMENTS</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Total Investments:', report.company_credits.total_credits.toString()],
              ['Total Investment Value:', `€${report.company_credits.total_credit_value.toLocaleString()}`],
              ['Available:', `€${report.company_credits.credits_available.toLocaleString()}`],
              ['Used:', `€${report.company_credits.credits_used.toLocaleString()}`],
              ['Cesija Payments:', report.company_credits.cesija_payments.toString()],
              ['Cesija Value:', `€${report.company_credits.cesija_value.toLocaleString()}`],
              ['Investment Allocations:', report.company_credits.total_allocations.toString()],
              ['Total Allocated:', `€${report.company_credits.allocated_amount.toLocaleString()}`]
            ].map(([label, value], i) => (
              <div key={i} className="flex justify-between">
                <span className="font-bold text-gray-700">{label}</span>
                <span className={`font-bold ${label === 'Available:' ? 'text-green-600' : 'text-gray-900'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center mb-4">
            <Wallet className="w-6 h-6 text-slate-600 mr-2" />
            <h2 className="text-xl font-bold text-slate-900">BANK ACCOUNTS</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="font-bold text-gray-700">Total Bank Accounts:</span><span className="font-bold text-gray-900">{report.bank_accounts.total_accounts}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-700">Total Balance:</span><span className={`font-bold ${report.bank_accounts.total_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>€{report.bank_accounts.total_balance.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-700">Positive Balance Accounts:</span><span className="font-bold text-green-600">{report.bank_accounts.positive_balance_accounts}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-700">Negative Balance Accounts:</span><span className="font-bold text-red-600">{report.bank_accounts.negative_balance_accounts}</span></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-sm border border-teal-200 p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-6 h-6 text-teal-600 mr-2" />
            <h2 className="text-xl font-bold text-teal-900">BUILDINGS & UNITS</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Total Buildings:', report.buildings_units.total_buildings.toString()],
              ['Total Units:', report.buildings_units.total_units.toString()],
              ['Sold Units:', report.buildings_units.sold_units.toString()],
              ['Reserved Units:', report.buildings_units.reserved_units.toString()],
              ['Available Units:', report.buildings_units.available_units.toString()],
              ['Garages:', report.buildings_units.total_garages.toString()],
              ['Repositories:', report.buildings_units.total_repositories.toString()]
            ].map(([label, value], i) => (
              <div key={i} className="flex justify-between">
                <span className="font-bold text-gray-700">{label}</span>
                <span className={`font-bold ${label === 'Sold Units:' ? 'text-green-600' : label === 'Reserved Units:' ? 'text-yellow-600' : 'text-gray-900'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
        <div className="flex items-center mb-4">
          <Home className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900">RETAIL PORTFOLIO</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div><p className="font-bold text-gray-700">Retail Projects:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_retail_projects}</p></div>
          <div><p className="font-bold text-gray-700">Active Projects:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.active_retail_projects}</p></div>
          <div><p className="font-bold text-gray-700">Land Plots:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_land_plots}</p></div>
          <div><p className="font-bold text-gray-700">Retail Contracts:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_retail_contracts}</p></div>
          <div><p className="font-bold text-gray-700">Contract Value:</p><p className="text-xl font-bold text-gray-900">€{report.retail_portfolio.retail_contract_value.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700">Budget Realized:</p><p className="text-xl font-bold text-gray-900">€{report.retail_portfolio.retail_budget_realized.toLocaleString()}</p></div>
          <div><p className="font-bold text-gray-700">Retail Phases:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.retail_phases}</p></div>
          <div><p className="font-bold text-gray-700">Completed Phases:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.completed_retail_phases}</p></div>
          <div><p className="font-bold text-gray-700">Retail Customers:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_retail_customers}</p></div>
          <div><p className="font-bold text-gray-700">Retail Suppliers:</p><p className="text-xl font-bold text-gray-900">{report.retail_portfolio.retail_suppliers}</p></div>
        </div>
      </div>

      {report.contract_types.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <FileText className="w-6 h-6 text-gray-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">CONTRACT TYPES</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {report.contract_types.map((ct, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-700 text-sm">{ct.name}</p>
                <p className="text-2xl font-bold text-gray-900">{ct.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">CASH FLOW ANALYSIS</h2>
        </div>
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>Month</Table.Th>
              <Table.Th>Inflow</Table.Th>
              <Table.Th>Outflow</Table.Th>
              <Table.Th>Net Cash Flow</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {report.cash_flow.map((month, index) => (
              <Table.Tr key={index}>
                <Table.Td className="font-medium text-gray-900">{month.month}</Table.Td>
                <Table.Td>€{(month.inflow / 1000).toFixed(0)}K</Table.Td>
                <Table.Td>€{(month.outflow / 1000).toFixed(0)}K</Table.Td>
                <Table.Td className={`font-bold ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  €{(month.net / 1000).toFixed(0)}K
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="font-bold text-gray-900">6-Month Totals:</p>
          <p className="text-sm text-gray-700">
            Inflow: €{(report.cash_flow.reduce((sum, m) => sum + m.inflow, 0) / 1000000).toFixed(2)}M |
            Outflow: €{(report.cash_flow.reduce((sum, m) => sum + m.outflow, 0) / 1000000).toFixed(2)}M |
            Net: €{(report.cash_flow.reduce((sum, m) => sum + m.net, 0) / 1000000).toFixed(2)}M
          </p>
        </div>
      </div>

      {report.projects.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">PROJECT-BY-PROJECT BREAKDOWN</h2>
          <div className="space-y-4">
            {report.projects.map((project) => (
              <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-600">{project.location}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={project.risk_level === 'High' ? 'red' : project.risk_level === 'Medium' ? 'yellow' : 'green'}>
                      Risk: {project.risk_level}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-gray-600">Status</p><p className="font-bold text-gray-900">{project.status}</p></div>
                  <div><p className="text-gray-600">Budget</p><p className="font-bold text-gray-900">€{project.budget.toLocaleString()}</p></div>
                  <div><p className="text-gray-600">Revenue</p><p className="font-bold text-green-600">€{project.revenue.toLocaleString()}</p></div>
                  <div><p className="text-gray-600">Expenses</p><p className="font-bold text-red-600">€{project.expenses.toLocaleString()}</p></div>
                  <div><p className="text-gray-600">Units</p><p className="font-bold text-gray-900">{project.units_sold}/{project.total_units} sold ({project.sales_rate.toFixed(1)}%)</p></div>
                  <div><p className="text-gray-600">Contracts</p><p className="font-bold text-gray-900">{project.contracts}</p></div>
                  <div><p className="text-gray-600">Phases</p><p className="font-bold text-gray-900">{project.phases_done}/{project.total_phases} done</p></div>
                  <div><p className="text-gray-600">Funding</p><p className="font-bold text-gray-900">€{project.equity.toLocaleString()} equity, €{project.debt.toLocaleString()} debt</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.risks.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm border border-red-200 p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <h2 className="text-2xl font-bold text-red-900">RISK ASSESSMENT</h2>
          </div>
          <ul className="space-y-2">
            {report.risks.map((risk, index) => (
              <li key={index} className="flex items-start">
                <span className="text-red-600 mr-2">•</span>
                <span className="text-gray-800"><strong>{risk.type}:</strong> {risk.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
        <div className="flex items-center mb-4">
          <Target className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900">EXECUTIVE INSIGHTS & RECOMMENDATIONS</h2>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">TOP PERFORMING PROJECTS:</h3>
          <ul className="space-y-2">
            {report.insights.top_projects.map((project, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2">-</span>
                <span className="text-gray-800">{project.name}: €{(project.revenue / 1000000).toFixed(1)}M revenue, {project.sales_rate.toFixed(1)}% sales rate</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">STRATEGIC RECOMMENDATIONS:</h3>
          <ul className="space-y-2">
            {report.insights.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2">•</span>
                <span className="text-gray-800">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default GeneralReports
