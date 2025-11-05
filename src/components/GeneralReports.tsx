import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Download,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  AlertTriangle,
  Target,
  PieChart,
  Activity,
  CheckCircle,
  Clock,
  Wallet,
  CreditCard,
  Percent,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Home
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'

interface ProjectData {
  id: string
  name: string
  location: string
  status: string
  budget: number
  revenue: number
  expenses: number
  units_sold: number
  total_units: number
  contracts: number
  phases_done: number
  total_phases: number
  equity: number
  debt: number
  sales_rate: number
  profit: number
  profit_margin: number
  risk_level: 'Low' | 'Medium' | 'High'
}

interface ComprehensiveReport {
  executive_summary: {
    total_projects: number
    active_projects: number
    completed_projects: number
    total_revenue: number
    total_expenses: number
    total_profit: number
    profit_margin: number
    portfolio_value: number
    roi: number
  }
  kpis: {
    portfolio_value: number
    total_revenue: number
    net_profit: number
    roi: number
    sales_rate: number
    debt_equity_ratio: number
    active_projects: number
    total_customers: number
  }
  sales_performance: {
    total_units: number
    units_sold: number
    available_units: number
    reserved_units: number
    total_revenue: number
    avg_sale_price: number
    total_sales: number
    buyers: number
    active_leads: number
    conversion_rate: number
  }
  funding_structure: {
    total_equity: number
    total_debt: number
    debt_equity_ratio: number
    total_credit_lines: number
    available_credit: number
    active_investors: number
    active_banks: number
    bank_credits: number
    avg_interest_rate: number
    monthly_debt_service: number
  }
  construction_status: {
    total_contracts: number
    active_contracts: number
    completed_contracts: number
    contract_value: number
    budget_realized: number
    budget_utilization: number
    total_subcontractors: number
    total_phases: number
    completed_phases: number
    work_logs_7days: number
  }
  cash_flow: Array<{
    month: string
    inflow: number
    outflow: number
    net: number
  }>
  projects: ProjectData[]
  risks: Array<{
    type: string
    count: number
    description: string
  }>
  insights: {
    top_projects: Array<{ name: string; revenue: number; sales_rate: number }>
    recommendations: string[]
  }
}

const GeneralReports: React.FC = () => {
  const [report, setReport] = useState<ComprehensiveReport | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  useEffect(() => {
    generateComprehensiveReport()
  }, [selectedProject, dateRange])

  const generateComprehensiveReport = async () => {
    setLoading(true)
    try {
      const reportData = await fetchAllData()
      setReport(reportData)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllData = async (): Promise<ComprehensiveReport> => {
    const { data: projects } = await supabase.from('projects').select('*')
    const { data: apartments } = await supabase.from('apartments').select('*')
    const { data: sales } = await supabase.from('sales').select('*')
    const { data: customers } = await supabase.from('customers').select('*')
    const { data: contracts } = await supabase.from('contracts').select('*')
    const { data: wirePayments } = await supabase.from('wire_payments').select('*')
    const { data: apartmentPayments } = await supabase.from('apartment_payments').select('*')
    const { data: subcontractors } = await supabase.from('subcontractors').select('*')
    const { data: projectPhases } = await supabase.from('project_phases').select('*')
    const { data: workLogs } = await supabase.from('work_logs').select('*')
    const { data: investors } = await supabase.from('investors').select('*')
    const { data: banks } = await supabase.from('banks').select('*')
    const { data: bankCredits } = await supabase.from('bank_credits').select('*')
    const { data: projectInvestments } = await supabase.from('project_investments').select('*')

    const projectsArray = projects || []
    const apartmentsArray = apartments || []
    const salesArray = sales || []
    const customersArray = customers || []
    const contractsArray = contracts || []
    const wirePaymentsArray = wirePayments || []
    const apartmentPaymentsArray = apartmentPayments || []
    const subcontractorsArray = subcontractors || []
    const projectPhasesArray = projectPhases || []
    const workLogsArray = workLogs || []
    const investorsArray = investors || []
    const banksArray = banks || []
    const bankCreditsArray = bankCredits || []
    const projectInvestmentsArray = projectInvestments || []

    const filteredProjects = selectedProject === 'all'
      ? projectsArray
      : projectsArray.filter(p => p.id === selectedProject)

    const totalRevenue = salesArray.reduce((sum, s) => sum + s.sale_price, 0)
    const totalExpenses = wirePaymentsArray.reduce((sum, p) => sum + p.amount, 0)
    const totalProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    const portfolioValue = projectsArray.reduce((sum, p) => sum + p.budget, 0)
    const totalEquity = projectInvestmentsArray.reduce((sum, inv) => sum + inv.amount, 0)
    const totalDebt = bankCreditsArray.reduce((sum, bc) => sum + bc.amount, 0)
    const roi = totalEquity > 0 ? (totalProfit / totalEquity) * 100 : 0

    const totalUnits = apartmentsArray.length
    const soldUnits = apartmentsArray.filter(a => a.status === 'Sold').length
    const reservedUnits = apartmentsArray.filter(a => a.status === 'Reserved').length
    const availableUnits = apartmentsArray.filter(a => a.status === 'Available').length
    const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
    const avgSalePrice = soldUnits > 0 ? totalRevenue / soldUnits : 0

    const buyers = customersArray.filter(c => c.status === 'buyer').length
    const leads = customersArray.filter(c => c.status === 'lead').length
    const interested = customersArray.filter(c => c.status === 'interested').length
    const conversionRate = customersArray.length > 0 ? (buyers / customersArray.length) * 100 : 0

    const avgInterestRate = bankCreditsArray.length > 0
      ? bankCreditsArray.reduce((sum, bc) => sum + bc.interest_rate, 0) / bankCreditsArray.length
      : 0
    const monthlyDebtService = bankCreditsArray.reduce((sum, bc) => sum + bc.monthly_payment, 0)

    const totalContractValue = contractsArray.reduce((sum, c) => sum + c.contract_amount, 0)
    const budgetRealized = contractsArray.reduce((sum, c) => sum + c.budget_realized, 0)
    const budgetUtilization = totalContractValue > 0 ? (budgetRealized / totalContractValue) * 100 : 0

    const completedPhases = projectPhasesArray.filter(p => p.status === 'completed').length
    const sevenDaysAgo = subMonths(new Date(), 0.25)
    const recentWorkLogs = workLogsArray.filter(w => new Date(w.date) >= sevenDaysAgo).length

    const months = eachMonthOfInterval({
      start: new Date(dateRange.start),
      end: new Date(dateRange.end)
    })

    const cashFlow = months.map(month => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      const monthInflow = apartmentPaymentsArray
        .filter(p => {
          const date = new Date(p.payment_date)
          return date >= monthStart && date <= monthEnd
        })
        .reduce((sum, p) => sum + p.amount, 0)

      const monthOutflow = wirePaymentsArray
        .filter(p => {
          const date = new Date(p.created_at)
          return date >= monthStart && date <= monthEnd
        })
        .reduce((sum, p) => sum + p.amount, 0)

      return {
        month: format(month, 'MMM yyyy'),
        inflow: monthInflow,
        outflow: monthOutflow,
        net: monthInflow - monthOutflow
      }
    })

    const projectDetails: ProjectData[] = await Promise.all(
      filteredProjects.map(async (project) => {
        const projectApartments = apartmentsArray.filter(a => a.project_id === project.id)
        const projectContracts = contractsArray.filter(c => c.project_id === project.id)
        const projectPhases = projectPhasesArray.filter(p => p.project_id === project.id)
        const projectInvestment = projectInvestmentsArray
          .filter(inv => inv.project_id === project.id)
          .reduce((sum, inv) => sum + inv.amount, 0)

        const projectBankCredits = bankCreditsArray.filter(bc => bc.project_id === project.id)
        const projectDebt = projectBankCredits.reduce((sum, bc) => sum + bc.amount, 0)

        const contractIds = projectContracts.map(c => c.id)
        const projectPayments = contractIds.length > 0
          ? wirePaymentsArray.filter(p => contractIds.includes(p.contract_id))
          : []
        const projectExpenses = projectPayments.reduce((sum, p) => sum + p.amount, 0)

        const soldApts = projectApartments.filter(a => a.status === 'Sold')
        const projectRevenue = soldApts.reduce((sum, a) => sum + a.price, 0)
        const projectProfit = projectRevenue - projectExpenses
        const projectProfitMargin = projectRevenue > 0 ? (projectProfit / projectRevenue) * 100 : 0
        const projectSalesRate = projectApartments.length > 0
          ? (soldApts.length / projectApartments.length) * 100
          : 0

        let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
        if (projectSalesRate < 20 || projectProfitMargin < 0) riskLevel = 'High'
        else if (projectSalesRate < 50 || projectProfitMargin < 15) riskLevel = 'Medium'

        return {
          id: project.id,
          name: project.name,
          location: project.location,
          status: project.status,
          budget: project.budget,
          revenue: projectRevenue,
          expenses: projectExpenses,
          units_sold: soldApts.length,
          total_units: projectApartments.length,
          contracts: projectContracts.length,
          phases_done: projectPhases.filter(p => p.status === 'completed').length,
          total_phases: projectPhases.length,
          equity: projectInvestment,
          debt: projectDebt,
          sales_rate: projectSalesRate,
          profit: projectProfit,
          profit_margin: projectProfitMargin,
          risk_level: riskLevel
        }
      })
    )

    const risks: Array<{ type: string; count: number; description: string }> = []
    const slowSalesProjects = projectDetails.filter(p => p.sales_rate < 40 && p.total_units > 0)
    if (slowSalesProjects.length > 0) {
      risks.push({
        type: 'SLOW SALES',
        count: slowSalesProjects.length,
        description: `${slowSalesProjects.length} project(s) with sales rate below 40%`
      })
    }

    const topProjects = [...projectDetails]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map(p => ({ name: p.name, revenue: p.revenue, sales_rate: p.sales_rate }))

    const recommendations: string[] = []
    if (salesRate < 50) recommendations.push('Intensify marketing efforts to accelerate sales velocity')
    if (availableUnits > soldUnits) recommendations.push('Significant inventory available - consider pricing strategies')
    recommendations.push('Continue monitoring project budgets and timeline adherence')
    recommendations.push('Maintain strong relationships with financing partners')

    return {
      executive_summary: {
        total_projects: projectsArray.length,
        active_projects: projectsArray.filter(p => p.status === 'In Progress').length,
        completed_projects: projectsArray.filter(p => p.status === 'Completed').length,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        total_profit: totalProfit,
        profit_margin: profitMargin,
        portfolio_value: portfolioValue,
        roi: roi
      },
      kpis: {
        portfolio_value: portfolioValue,
        total_revenue: totalRevenue,
        net_profit: totalProfit,
        roi: roi,
        sales_rate: salesRate,
        debt_equity_ratio: totalEquity > 0 ? totalDebt / totalEquity : 0,
        active_projects: projectsArray.filter(p => p.status === 'In Progress').length,
        total_customers: customersArray.length
      },
      sales_performance: {
        total_units: totalUnits,
        units_sold: soldUnits,
        available_units: availableUnits,
        reserved_units: reservedUnits,
        total_revenue: totalRevenue,
        avg_sale_price: avgSalePrice,
        total_sales: salesArray.length,
        buyers: buyers,
        active_leads: leads + interested,
        conversion_rate: conversionRate
      },
      funding_structure: {
        total_equity: totalEquity,
        total_debt: totalDebt,
        debt_equity_ratio: totalEquity > 0 ? totalDebt / totalEquity : 0,
        total_credit_lines: bankCreditsArray.reduce((sum, bc) => sum + bc.amount, 0),
        available_credit: totalEquity - totalExpenses,
        active_investors: investorsArray.length,
        active_banks: banksArray.length,
        bank_credits: bankCreditsArray.length,
        avg_interest_rate: avgInterestRate,
        monthly_debt_service: monthlyDebtService
      },
      construction_status: {
        total_contracts: contractsArray.length,
        active_contracts: contractsArray.filter(c => c.status === 'active').length,
        completed_contracts: contractsArray.filter(c => c.status === 'completed').length,
        contract_value: totalContractValue,
        budget_realized: budgetRealized,
        budget_utilization: budgetUtilization,
        total_subcontractors: subcontractorsArray.length,
        total_phases: projectPhasesArray.length,
        completed_phases: completedPhases,
        work_logs_7days: recentWorkLogs
      },
      cash_flow: cashFlow,
      projects: projectDetails,
      risks: risks,
      insights: {
        top_projects: topProjects,
        recommendations: recommendations
      }
    }
  }

  const generatePDF = async () => {
    if (!report) return
    setGeneratingPDF(true)

    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let yPosition = margin

      const checkPageBreak = (height: number) => {
        if (yPosition + height > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
          return true
        }
        return false
      }

      pdf.setFillColor(37, 99, 235)
      pdf.rect(0, 0, pageWidth, 50, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(28)
      pdf.setFont('helvetica', 'bold')
      pdf.text('LANDMARK GROUP', margin, 25)

      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Comprehensive Executive Report', margin, 35)

      pdf.setFontSize(10)
      pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, 42)

      pdf.setTextColor(0, 0, 0)
      yPosition = 60

      pdf.setFillColor(240, 245, 250)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('EXECUTIVE SUMMARY', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const summaryLines = [
        `• Portfolio: ${report.executive_summary.total_projects} projects (${report.executive_summary.active_projects} active, ${report.executive_summary.completed_projects} completed)`,
        `• Financial: €${(report.executive_summary.total_revenue / 1000000).toFixed(1)}M revenue, €${(report.executive_summary.total_expenses / 1000000).toFixed(1)}M expenses, €${(report.executive_summary.total_profit / 1000000).toFixed(1)}M profit (${report.executive_summary.profit_margin.toFixed(1)}% margin)`,
        `• Capital Structure: €${(report.funding_structure.total_equity / 1000000).toFixed(1)}M equity, €${(report.funding_structure.total_debt / 1000000).toFixed(1)}M debt, ${report.funding_structure.debt_equity_ratio.toFixed(2)} D/E ratio`,
        `• Sales: ${report.sales_performance.units_sold}/${report.sales_performance.total_units} units sold (${report.sales_performance.units_sold > 0 ? ((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1) : '0'}%), ${report.sales_performance.total_sales} transactions`,
        `• Construction: ${report.construction_status.total_contracts} contracts, ${report.construction_status.total_subcontractors} subcontractors, ${report.construction_status.work_logs_7days} work logs recorded`
      ]

      summaryLines.forEach((line, index) => {
        pdf.text(line, margin + 5, yPosition + 20 + (index * 6))
      })

      yPosition += 60

      checkPageBreak(40)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('KEY PERFORMANCE INDICATORS', margin, yPosition)
      yPosition += 10

      const kpiData = [
        ['€' + (report.kpis.portfolio_value / 1000000).toFixed(2) + 'M', 'Portfolio Value'],
        ['€' + (report.kpis.total_revenue / 1000000).toFixed(2) + 'M', 'Total Revenue'],
        ['€' + (report.kpis.net_profit / 1000000).toFixed(2) + 'M', 'Net Profit'],
        [report.kpis.roi.toFixed(1) + '%', 'ROI'],
        [report.kpis.sales_rate.toFixed(1) + '%', 'Sales Rate'],
        [report.kpis.debt_equity_ratio.toFixed(2), 'D/E Ratio'],
        [report.kpis.active_projects.toString(), 'Active Projects'],
        [report.kpis.total_customers.toString(), 'Total Customers']
      ]

      const kpiBoxWidth = 45
      const kpiBoxHeight = 20
      let xPos = margin
      let kpiRow = 0

      kpiData.forEach((kpi, index) => {
        if (index > 0 && index % 4 === 0) {
          kpiRow++
          xPos = margin
          yPosition += kpiBoxHeight + 5
        }

        pdf.setFillColor(240, 245, 250)
        pdf.rect(xPos, yPosition, kpiBoxWidth, kpiBoxHeight, 'F')

        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        pdf.text(kpi[0], xPos + kpiBoxWidth / 2, yPosition + 10, { align: 'center' })

        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(100, 100, 100)
        pdf.text(kpi[1], xPos + kpiBoxWidth / 2, yPosition + 16, { align: 'center' })

        xPos += kpiBoxWidth + 2
      })

      yPosition += 30

      checkPageBreak(60)
      pdf.setFillColor(220, 252, 231)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 40, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(22, 163, 74)
      pdf.text('SALES PERFORMANCE', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const salesData = [
        ['Total Units:', report.sales_performance.total_units.toString(), 'Avg Sale Price:', '€' + report.sales_performance.avg_sale_price.toLocaleString()],
        ['Units Sold:', `${report.sales_performance.units_sold} (${((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1)}%)`, 'Total Sales:', report.sales_performance.total_sales.toString()],
        ['Available:', report.sales_performance.available_units.toString(), 'Buyers:', report.sales_performance.buyers.toString()],
        ['Reserved:', report.sales_performance.reserved_units.toString(), 'Active Leads:', report.sales_performance.active_leads.toString()],
        ['Total Revenue:', '€' + report.sales_performance.total_revenue.toLocaleString(), 'Conversion Rate:', report.sales_performance.conversion_rate.toFixed(1) + '%']
      ]

      salesData.forEach((row, index) => {
        const y = yPosition + 18 + (index * 4)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 35, y)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[2], margin + 95, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[3], margin + 125, y)
      })

      yPosition += 50

      pdf.addPage()
      yPosition = margin

      pdf.setFillColor(254, 243, 199)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(245, 158, 11)
      pdf.text('FUNDING & FINANCIAL STRUCTURE', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const fundingData = [
        ['Total Equity Invested:', '€' + report.funding_structure.total_equity.toLocaleString(), 'Active Investors:', report.funding_structure.active_investors.toString()],
        ['Total Debt:', '€' + report.funding_structure.total_debt.toLocaleString(), 'Active Banks:', report.funding_structure.active_banks.toString()],
        ['Debt-to-Equity Ratio:', report.funding_structure.debt_equity_ratio.toFixed(2), 'Bank Credits:', report.funding_structure.bank_credits.toString()],
        ['Total Credit Lines:', '€' + report.funding_structure.total_credit_lines.toLocaleString(), 'Avg Interest Rate:', report.funding_structure.avg_interest_rate.toFixed(2) + '%'],
        ['Available Credit:', '€' + report.funding_structure.available_credit.toLocaleString(), 'Monthly Debt Service:', '€' + report.funding_structure.monthly_debt_service.toLocaleString()]
      ]

      fundingData.forEach((row, index) => {
        const y = yPosition + 18 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 50, y)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[2], margin + 105, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[3], margin + 145, y)
      })

      yPosition += 60

      checkPageBreak(50)
      pdf.setFillColor(254, 226, 226)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(220, 38, 38)
      pdf.text('CONSTRUCTION & SUPERVISION STATUS', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const constructionData = [
        ['Total Contracts:', report.construction_status.total_contracts.toString(), 'Budget Utilization:', report.construction_status.budget_utilization.toFixed(1) + '%'],
        ['Active Contracts:', report.construction_status.active_contracts.toString(), 'Total Subcontractors:', report.construction_status.total_subcontractors.toString()],
        ['Completed Contracts:', report.construction_status.completed_contracts.toString(), 'Total Phases:', report.construction_status.total_phases.toString()],
        ['Contract Value:', '€' + report.construction_status.contract_value.toLocaleString(), 'Completed Phases:', report.construction_status.completed_phases.toString()],
        ['Budget Realized:', '€' + report.construction_status.budget_realized.toLocaleString(), 'Work Logs (7 days):', report.construction_status.work_logs_7days.toString()]
      ]

      constructionData.forEach((row, index) => {
        const y = yPosition + 18 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 45, y)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[2], margin + 105, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[3], margin + 145, y)
      })

      yPosition += 60

      checkPageBreak(60)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('CASH FLOW ANALYSIS', margin, yPosition)
      yPosition += 10

      pdf.setFillColor(240, 240, 240)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Month', margin + 5, yPosition + 5)
      pdf.text('Inflow', margin + 50, yPosition + 5)
      pdf.text('Outflow', margin + 90, yPosition + 5)
      pdf.text('Net Cash Flow', margin + 130, yPosition + 5)

      yPosition += 10

      pdf.setFont('helvetica', 'normal')
      let totalInflow = 0
      let totalOutflow = 0
      let totalNet = 0

      report.cash_flow.forEach((month, index) => {
        totalInflow += month.inflow
        totalOutflow += month.outflow
        totalNet += month.net

        pdf.text(month.month, margin + 5, yPosition + (index * 5))
        pdf.text('€' + (month.inflow / 1000).toFixed(0) + 'K', margin + 50, yPosition + (index * 5))
        pdf.text('€' + (month.outflow / 1000).toFixed(0) + 'K', margin + 90, yPosition + (index * 5))

        pdf.setTextColor(month.net >= 0 ? 22 : 220, month.net >= 0 ? 163 : 38, month.net >= 0 ? 74 : 38)
        pdf.text('€' + (month.net / 1000).toFixed(0) + 'K', margin + 130, yPosition + (index * 5))
        pdf.setTextColor(0, 0, 0)
      })

      yPosition += report.cash_flow.length * 5 + 5

      pdf.setFont('helvetica', 'bold')
      pdf.text(`6-Month Totals:`, margin + 5, yPosition)
      pdf.text(`Inflow: €${(totalInflow / 1000000).toFixed(2)}M | Outflow: €${(totalOutflow / 1000000).toFixed(2)}M | Net: €${(totalNet / 1000000).toFixed(2)}M`, margin + 5, yPosition + 5)

      yPosition += 15

      if (report.projects.length > 0) {
        pdf.addPage()
        yPosition = margin

        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        pdf.text('PROJECT-BY-PROJECT BREAKDOWN', margin, yPosition)
        yPosition += 10

        report.projects.forEach((project) => {
          checkPageBreak(40)

          pdf.setFillColor(240, 240, 240)
          pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')

          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(0, 0, 0)
          pdf.text(project.name, margin + 5, yPosition + 5)

          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(100, 100, 100)
          pdf.text(project.location, pageWidth - margin - 50, yPosition + 5)

          yPosition += 12

          pdf.setFontSize(9)
          pdf.setTextColor(0, 0, 0)

          const projectData = [
            ['Status:', project.status, 'Units:', `${project.units_sold}/${project.total_units} sold (${project.sales_rate.toFixed(1)}%)`],
            ['Budget:', '€' + project.budget.toLocaleString(), 'Contracts:', project.contracts.toString()],
            ['Revenue:', '€' + project.revenue.toLocaleString(), 'Phases:', `${project.phases_done}/${project.total_phases} done`],
            ['Expenses:', '€' + project.expenses.toLocaleString(), 'Funding:', `€${project.equity.toLocaleString()} equity, €${project.debt.toLocaleString()} debt`]
          ]

          projectData.forEach((row, index) => {
            const y = yPosition + (index * 5)
            pdf.setFont('helvetica', 'bold')
            pdf.text(row[0], margin + 5, y)
            pdf.setFont('helvetica', 'normal')
            pdf.text(row[1], margin + 30, y)
            pdf.setFont('helvetica', 'bold')
            pdf.text(row[2], margin + 95, y)
            pdf.setFont('helvetica', 'normal')
            pdf.text(row[3], margin + 115, y)
          })

          yPosition += 20

          pdf.setFont('helvetica', 'bold')
          pdf.text('Risk:', margin + 5, yPosition)

          const riskColor = project.risk_level === 'High' ? [220, 38, 38] : project.risk_level === 'Medium' ? [245, 158, 11] : [22, 163, 74]
          pdf.setTextColor(riskColor[0], riskColor[1], riskColor[2])
          pdf.text(project.risk_level, margin + 20, yPosition)
          pdf.setTextColor(0, 0, 0)

          yPosition += 10
        })
      }

      if (report.risks.length > 0) {
        pdf.addPage()
        yPosition = margin

        pdf.setFillColor(254, 226, 226)
        pdf.rect(margin, yPosition, pageWidth - 2 * margin, 20, 'F')

        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(220, 38, 38)
        pdf.text('RISK ASSESSMENT', margin + 5, yPosition + 10)
        yPosition += 25

        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(0, 0, 0)

        report.risks.forEach((risk, index) => {
          pdf.text(`• ${risk.type}: ${risk.description}`, margin + 5, yPosition + (index * 5))
        })

        yPosition += report.risks.length * 5 + 10
      }

      checkPageBreak(50)
      pdf.setFillColor(220, 252, 231)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 40, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(22, 163, 74)
      pdf.text('EXECUTIVE INSIGHTS & RECOMMENDATIONS', margin + 5, yPosition + 10)
      yPosition += 18

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text('TOP PERFORMING PROJECTS:', margin + 5, yPosition)
      yPosition += 5

      pdf.setFont('helvetica', 'normal')
      report.insights.top_projects.forEach((project, index) => {
        pdf.text(` - ${project.name}: €${(project.revenue / 1000000).toFixed(1)}M revenue, ${project.sales_rate.toFixed(1)}% sales rate`, margin + 5, yPosition + (index * 5))
      })

      yPosition += report.insights.top_projects.length * 5 + 5

      pdf.setFont('helvetica', 'bold')
      pdf.text('STRATEGIC RECOMMENDATIONS:', margin + 5, yPosition)
      yPosition += 5

      pdf.setFont('helvetica', 'normal')
      report.insights.recommendations.forEach((rec, index) => {
        pdf.text(`• ${rec}`, margin + 5, yPosition + (index * 5))
      })

      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(100, 100, 100)
        pdf.text('LANDMARK GROUP - Confidential Executive Report', margin, pageHeight - 10)
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10)
      }

      pdf.save(`LANDMARK_Comprehensive_Executive_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Generating comprehensive report...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No data available for report generation</p>
      </div>
    )
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
          <button
            onClick={generatePDF}
            disabled={generatingPDF}
            className="flex items-center px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-semibold shadow-lg disabled:opacity-50"
          >
            <Download className="w-5 h-5 mr-2" />
            {generatingPDF ? 'Generating...' : 'Export PDF'}
          </button>
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
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl text-center border border-purple-200">
            <p className="text-3xl font-bold text-purple-600">€{(report.kpis.net_profit / 1000000).toFixed(1)}M</p>
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
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl text-center border border-indigo-200">
            <p className="text-3xl font-bold text-indigo-600">{report.kpis.active_projects}</p>
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
          <div>
            <p className="font-bold text-gray-700">Total Units:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.total_units}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Units Sold:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.units_sold} ({((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1)}%)</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Available:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.available_units}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Reserved:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.reserved_units}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Total Revenue:</p>
            <p className="text-xl font-bold text-gray-900">€{report.sales_performance.total_revenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Avg Sale Price:</p>
            <p className="text-xl font-bold text-gray-900">€{report.sales_performance.avg_sale_price.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Total Sales:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.total_sales}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Buyers:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.buyers}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Active Leads:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.active_leads}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Conversion Rate:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.conversion_rate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-6">
          <div className="flex items-center mb-4">
            <Wallet className="w-6 h-6 text-purple-600 mr-2" />
            <h2 className="text-xl font-bold text-purple-900">FUNDING & FINANCIAL STRUCTURE</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Equity Invested:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.total_equity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Debt:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.total_debt.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Debt-to-Equity Ratio:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.debt_equity_ratio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Credit Lines:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.total_credit_lines.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Available Credit:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.available_credit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Active Investors:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.active_investors}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Active Banks:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.active_banks}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Bank Credits:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.bank_credits}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Avg Interest Rate:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.avg_interest_rate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Monthly Debt Service:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.monthly_debt_service.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border border-orange-200 p-6">
          <div className="flex items-center mb-4">
            <Activity className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-xl font-bold text-orange-900">CONSTRUCTION & SUPERVISION STATUS</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Contracts:</span>
              <span className="font-bold text-gray-900">{report.construction_status.total_contracts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Active Contracts:</span>
              <span className="font-bold text-gray-900">{report.construction_status.active_contracts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Completed Contracts:</span>
              <span className="font-bold text-gray-900">{report.construction_status.completed_contracts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Contract Value:</span>
              <span className="font-bold text-gray-900">€{report.construction_status.contract_value.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Budget Realized:</span>
              <span className="font-bold text-gray-900">€{report.construction_status.budget_realized.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Budget Utilization:</span>
              <span className="font-bold text-gray-900">{report.construction_status.budget_utilization.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Subcontractors:</span>
              <span className="font-bold text-gray-900">{report.construction_status.total_subcontractors}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Phases:</span>
              <span className="font-bold text-gray-900">{report.construction_status.total_phases}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Completed Phases:</span>
              <span className="font-bold text-gray-900">{report.construction_status.completed_phases}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Work Logs (7 days):</span>
              <span className="font-bold text-gray-900">{report.construction_status.work_logs_7days}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">CASH FLOW ANALYSIS</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Month</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Inflow</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Outflow</th>
                <th className="px-4 py-3 text-left font-bold text-gray-700">Net Cash Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.cash_flow.map((month, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{month.month}</td>
                  <td className="px-4 py-3 text-gray-900">€{(month.inflow / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-3 text-gray-900">€{(month.outflow / 1000).toFixed(0)}K</td>
                  <td className={`px-4 py-3 font-bold ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{(month.net / 1000).toFixed(0)}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      project.risk_level === 'High' ? 'bg-red-100 text-red-800' :
                      project.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      Risk: {project.risk_level}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Status</p>
                    <p className="font-bold text-gray-900">{project.status}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Budget</p>
                    <p className="font-bold text-gray-900">€{project.budget.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Revenue</p>
                    <p className="font-bold text-green-600">€{project.revenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Expenses</p>
                    <p className="font-bold text-red-600">€{project.expenses.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Units</p>
                    <p className="font-bold text-gray-900">{project.units_sold}/{project.total_units} sold ({project.sales_rate.toFixed(1)}%)</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Contracts</p>
                    <p className="font-bold text-gray-900">{project.contracts}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phases</p>
                    <p className="font-bold text-gray-900">{project.phases_done}/{project.total_phases} done</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Funding</p>
                    <p className="font-bold text-gray-900">€{project.equity.toLocaleString()} equity, €{project.debt.toLocaleString()} debt</p>
                  </div>
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
