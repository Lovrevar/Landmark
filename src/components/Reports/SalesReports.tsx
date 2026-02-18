import React, { useState, useEffect } from 'react'
import { supabase, Project, Apartment, Customer, Sale } from '../../lib/supabase'
import {
  TrendingUp,
  DollarSign,
  Home,
  Users,
  Download,
  Activity
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import { PageHeader, StatGrid, LoadingSpinner, Button, Badge, Select, FormField, Input, Table, StatCard } from '../ui'

interface SalesData {
  month: string
  sales: number
  revenue: number
  units_sold: number
}

interface ProjectSalesReport {
  project: Project
  total_units: number
  sold_units: number
  available_units: number
  reserved_units: number
  total_revenue: number
  average_price: number
  sales_rate: number
  monthly_sales: SalesData[]
  apartments: Apartment[]
  sales: Sale[]
}

interface CustomerReport {
  total_customers: number
  buyers: number
  interested: number
  leads: number
  total_revenue: number
  average_purchase: number
  customers: Customer[]
}

const SalesReports: React.FC = () => {
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
    fetchProjects()
  }, [])

  useEffect(() => {
    if (reportType === 'project' && selectedProject) {
      generateProjectReport()
    } else if (reportType === 'customer') {
      generateCustomerReport()
    }
  }, [selectedProject, dateRange, reportType])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (error) throw error
      setProjects(projectsData || [])
      
      if (projectsData && projectsData.length > 0) {
        setSelectedProject(projectsData[0].id)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateProjectReport = async () => {
    if (!selectedProject) return

    setGeneratingReport(true)
    try {
      const project = projects.find(p => p.id === selectedProject)
      if (!project) return

      // Fetch bank credits directly assigned to this project
      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select('*, banks(name)')
        .eq('project_id', selectedProject)

      if (creditsError) throw creditsError

      // Fetch credit allocations for this project (new funding model)
      const { data: allocationsData, error: allocationsError } = await supabase
        .from('credit_allocations')
        .select('*, bank_credits(banks(name))')
        .eq('project_id', selectedProject)

      if (allocationsError) throw allocationsError

      // Collect unique bank names from both direct credits and allocations
      const bankNamesFromCredits = (creditsData || [])
        .map(credit => credit.banks?.name)
        .filter(Boolean) as string[]

      const bankNamesFromAllocations = (allocationsData || [])
        .map(alloc => (alloc.bank_credits as any)?.banks?.name)
        .filter(Boolean) as string[]

      const fundingSources = [...new Set([...bankNamesFromCredits, ...bankNamesFromAllocations])].join(', ') || 'N/A'

      // Add funding info to project
      const projectWithFunding = {
        ...project,
        investor: fundingSources
      }

      // Fetch apartments for the selected project
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')
        .eq('project_id', selectedProject)

      if (apartmentsError) throw apartmentsError

      const apartments = apartmentsData || []

      // Get all linked garage and storage IDs
      const garageIds = apartments.map(apt => apt.garage_id).filter(Boolean)
      const storageIds = apartments.map(apt => apt.repository_id).filter(Boolean)

      // Fetch garages and storages data
      const { data: garagesData } = await supabase
        .from('garages')
        .select('id, price')
        .in('id', garageIds.length > 0 ? garageIds : [''])

      const { data: storagesData } = await supabase
        .from('repositories')
        .select('id, price')
        .in('id', storageIds.length > 0 ? storageIds : [''])

      // Create maps for quick lookup
      const garageMap = new Map((garagesData || []).map(g => [g.id, g.price]))
      const storageMap = new Map((storagesData || []).map(s => [s.id, s.price]))

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          apartments!inner(project_id, garage_id, repository_id)
        `)
        .eq('apartments.project_id', selectedProject)
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end)

      if (salesError) throw salesError

      const sales = salesData || []

      // Calculate total revenue including linked units
      const total_revenue = sales.reduce((sum, sale) => {
        let saleTotal = sale.sale_price

        // Add garage price if linked
        if (sale.apartments?.garage_id) {
          saleTotal += garageMap.get(sale.apartments.garage_id) || 0
        }

        // Add storage price if linked
        if (sale.apartments?.repository_id) {
          saleTotal += storageMap.get(sale.apartments.repository_id) || 0
        }

        return sum + saleTotal
      }, 0)

      // Calculate project statistics
      const total_units = apartments.length
      const sold_units = apartments.filter(apt => apt.status === 'Sold').length
      const available_units = apartments.filter(apt => apt.status === 'Available').length
      const reserved_units = apartments.filter(apt => apt.status === 'Reserved').length

      // Calculate average price including linked units
      const totalValue = apartments.reduce((sum, apt) => {
        let aptTotal = apt.price
        if (apt.garage_id) aptTotal += garageMap.get(apt.garage_id) || 0
        if (apt.repository_id) aptTotal += storageMap.get(apt.repository_id) || 0
        return sum + aptTotal
      }, 0)
      const average_price = total_units > 0 ? totalValue / total_units : 0
      const sales_rate = total_units > 0 ? (sold_units / total_units) * 100 : 0

      // Generate monthly sales data
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      const months = eachMonthOfInterval({ start: startDate, end: endDate })
      
      const monthly_sales: SalesData[] = months.map(month => {
        const monthStart = startOfMonth(month)
        const monthEnd = endOfMonth(month)

        const monthSales = sales.filter(sale => {
          const saleDate = new Date(sale.sale_date)
          return saleDate >= monthStart && saleDate <= monthEnd
        })

        // Calculate revenue including linked units
        const monthRevenue = monthSales.reduce((sum, sale) => {
          let saleTotal = sale.sale_price
          if (sale.apartments?.garage_id) {
            saleTotal += garageMap.get(sale.apartments.garage_id) || 0
          }
          if (sale.apartments?.repository_id) {
            saleTotal += storageMap.get(sale.apartments.repository_id) || 0
          }
          return sum + saleTotal
        }, 0)

        return {
          month: format(month, 'MMM yyyy'),
          sales: monthSales.length,
          revenue: monthRevenue,
          units_sold: monthSales.length
        }
      })

      setProjectReport({
        project: projectWithFunding,
        total_units,
        sold_units,
        available_units,
        reserved_units,
        total_revenue,
        average_price,
        sales_rate,
        monthly_sales,
        apartments,
        sales
      })
    } catch (error) {
      console.error('Error generating project report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const generateCustomerReport = async () => {
    setGeneratingReport(true)
    try {
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')

      if (customersError) throw customersError

      // Fetch sales data for revenue calculation
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end)

      if (salesError) throw salesError

      const customers = customersData || []
      const sales = salesData || []

      const total_customers = customers.length
      const buyers = customers.filter(c => c.status === 'buyer').length
      const interested = customers.filter(c => c.status === 'interested').length
      const leads = customers.filter(c => c.status === 'lead').length
      const total_revenue = sales.reduce((sum, sale) => sum + sale.sale_price, 0)
      const average_purchase = sales.length > 0 ? total_revenue / sales.length : 0

      setCustomerReport({
        total_customers,
        buyers,
        interested,
        leads,
        total_revenue,
        average_purchase,
        customers
      })
    } catch (error) {
      console.error('Error generating customer report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const generatePDFReport = async () => {
    if (reportType === 'project' && !projectReport) return
    if (reportType === 'customer' && !customerReport) return

    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const contentWidth = pageWidth - (margin * 2)
      let yPosition = margin

      // Helper function to check page break
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
          return true
        }
        return false
      }

      // Helper function to add text with word wrap
      const addText = (text: string, x: number, y: number, options: any = {}) => {
        const fontSize = options.fontSize || 10
        const maxWidth = options.maxWidth || contentWidth
        const lineHeight = options.lineHeight || fontSize * 0.35

        pdf.setFontSize(fontSize)
        if (options.style) pdf.setFont('helvetica', options.style)
        if (options.color) pdf.setTextColor(options.color[0], options.color[1], options.color[2])

        const lines = pdf.splitTextToSize(text, maxWidth)
        for (let i = 0; i < lines.length; i++) {
          checkPageBreak(lineHeight)
          pdf.text(lines[i], x, y + (i * lineHeight))
        }
        return y + (lines.length * lineHeight)
      }

      if (reportType === 'project' && projectReport) {
        // Header
        pdf.setFillColor(37, 99, 235)
        pdf.rect(0, 0, pageWidth, 35, 'F')
        
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(20)
        pdf.setFont('helvetica', 'bold')
        pdf.text('LANDMARK GROUP Sales Report', margin, 20)
        
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'normal')
        pdf.text(projectReport.project.name, margin, 28)
        
        pdf.setTextColor(0, 0, 0)
        yPosition = 45

        // Report metadata
        pdf.setFontSize(10)
        pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, yPosition)
        pdf.text(`Report Period: ${format(new Date(dateRange.start), 'MMM dd, yyyy')} - ${format(new Date(dateRange.end), 'MMM dd, yyyy')}`, margin, yPosition + 5)
        yPosition += 20

        // Project Overview
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        yPosition = addText('Project Overview', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
        yPosition += 5

        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')

        const overviewData = [
          ['Location', projectReport.project.location],
          ['Status', projectReport.project.status],
          ['Start Date', format(new Date(projectReport.project.start_date), 'MMMM dd, yyyy')],
          ['Budget', `$${projectReport.project.budget.toLocaleString('hr-HR')}`],
          ['Total Units', projectReport.total_units.toString()],
          ['Units Sold', `${projectReport.sold_units} (${projectReport.sales_rate.toFixed(1)}%)`],
          ['Available Units', projectReport.available_units.toString()],
          ['Reserved Units', projectReport.reserved_units.toString()],
          ['Total Revenue', `$${projectReport.total_revenue.toLocaleString('hr-HR')}`],
          ['Average Price', `$${projectReport.average_price.toLocaleString('hr-HR')}`]
        ]

        overviewData.forEach(([label, value], index) => {
          const y = yPosition + (index * 6)
          checkPageBreak(6)
          
          pdf.setFont('helvetica', 'bold')
          pdf.text(`${label}:`, margin + 5, y)
          pdf.setFont('helvetica', 'normal')
          pdf.text(value, margin + 60, y)
        })

        yPosition += (overviewData.length * 6) + 15

        // Monthly Sales Data
        checkPageBreak(40)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        yPosition = addText('Monthly Sales Performance', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
        yPosition += 10

        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')

        projectReport.monthly_sales.forEach((month, index) => {
          checkPageBreak(6)
          const y = yPosition + (index * 6)
          pdf.text(`${month.month}:`, margin + 5, y)
          pdf.text(`${month.units_sold} units sold`, margin + 40, y)
          pdf.text(`$${month.revenue.toLocaleString('hr-HR')} revenue`, margin + 80, y)
        })

        yPosition += (projectReport.monthly_sales.length * 6) + 15

        // Apartment Details
        checkPageBreak(40)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        yPosition = addText('Apartment Details', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
        yPosition += 10

        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')

        projectReport.apartments.forEach((apt, index) => {
          checkPageBreak(8)
          const y = yPosition + (index * 8)
          const statusColor = apt.status === 'Sold' ? [34, 197, 94] : apt.status === 'Reserved' ? [245, 158, 11] : [59, 130, 246]
          
          pdf.text(`Unit ${apt.number} (Floor ${apt.floor}):`, margin + 5, y)
          pdf.text(`${apt.size_m2}m²`, margin + 50, y)
          pdf.text(`$${apt.price.toLocaleString('hr-HR')}`, margin + 80, y)
          
          pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
          pdf.setFont('helvetica', 'bold')
          pdf.text(apt.status, margin + 120, y)
          pdf.setTextColor(0, 0, 0)
          pdf.setFont('helvetica', 'normal')
          
          if (apt.buyer_name) {
            pdf.text(`(${apt.buyer_name})`, margin + 145, y)
          }
        })

      } else if (reportType === 'customer' && customerReport) {
        // Header
        pdf.setFillColor(37, 99, 235)
        pdf.rect(0, 0, pageWidth, 35, 'F')
        
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(20)
        pdf.setFont('helvetica', 'bold')
        pdf.text('LANDMARK GROUP Customer Report', margin, 20)
        
        pdf.setTextColor(0, 0, 0)
        yPosition = 45

        // Report metadata
        pdf.setFontSize(10)
        pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, yPosition)
        pdf.text(`Report Period: ${format(new Date(dateRange.start), 'MMM dd, yyyy')} - ${format(new Date(dateRange.end), 'MMM dd, yyyy')}`, margin, yPosition + 5)
        yPosition += 20

        // Customer Overview
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        yPosition = addText('Customer Overview', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
        yPosition += 5

        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')

        const customerOverviewData = [
          ['Total Customers', customerReport.total_customers.toString()],
          ['Buyers', `${customerReport.buyers} (${customerReport.total_customers > 0 ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1) : '0'}%)`],
          ['Interested Customers', customerReport.interested.toString()],
          ['Leads', customerReport.leads.toString()],
          ['Total Revenue', `$${customerReport.total_revenue.toLocaleString('hr-HR')}`],
          ['Average Purchase', `$${customerReport.average_purchase.toLocaleString('hr-HR')}`],
          ['Conversion Rate', `${customerReport.total_customers > 0 ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1) : '0'}%`]
        ]

        customerOverviewData.forEach(([label, value], index) => {
          const y = yPosition + (index * 6)
          checkPageBreak(6)
          
          pdf.setFont('helvetica', 'bold')
          pdf.text(`${label}:`, margin + 5, y)
          pdf.setFont('helvetica', 'normal')
          pdf.text(value, margin + 60, y)
        })

        yPosition += (customerOverviewData.length * 6) + 15

        // Customer Details
        checkPageBreak(40)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        yPosition = addText('Customer Details', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
        yPosition += 10

        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')

        customerReport.customers.forEach((customer, index) => {
          checkPageBreak(8)
          const y = yPosition + (index * 8)
          const statusColor = customer.status === 'buyer' ? [34, 197, 94] : customer.status === 'interested' ? [59, 130, 246] : [245, 158, 11]
          
          pdf.text(`${customer.name} ${customer.surname}`, margin + 5, y)
          pdf.text(customer.email, margin + 60, y)
          pdf.text(customer.phone || 'No phone', margin + 120, y)
          
          pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
          pdf.setFont('helvetica', 'bold')
          pdf.text(customer.status.toUpperCase(), margin + 160, y)
          pdf.setTextColor(0, 0, 0)
          pdf.setFont('helvetica', 'normal')
        })
      }

      // Footer
      const footerY = pageHeight - 15
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(107, 114, 128)
      pdf.text('LANDMARK GROUP - Sales Report', margin, footerY)
      pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin - 20, footerY)

      // Save the PDF
      const fileName = `${reportType === 'project' ? 'Sales' : 'Customer'}_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF report. Please try again.')
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading reports..." />
  }

  return (
    <div>
      <PageHeader
        title="Sales Reports"
        description="Generate comprehensive sales analytics and reports"
        actions={
          (projectReport || customerReport) ? (
            <Button icon={Download} onClick={generatePDFReport}>
              Export Report
            </Button>
          ) : undefined
        }
        className="mb-6"
      />

      {/* Report Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField label="Report Type">
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'project' | 'customer')}
            >
              <option value="project">Project Sales Report</option>
              <option value="customer">Customer Report</option>
            </Select>
          </FormField>

          {reportType === 'project' && (
            <FormField label="Project">
              <Select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label="Start Date">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label="End Date">
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {generatingReport && (
        <LoadingSpinner message="Generating report..." />
      )}

      {/* Project Report */}
      {reportType === 'project' && projectReport && !generatingReport && (
        <div className="space-y-6">
          {/* Project Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Project Sales Overview</h2>
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
                <h3 className="font-semibold text-gray-900 mb-3">{projectReport.project.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium">{projectReport.project.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium">{format(new Date(projectReport.project.start_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Budget:</span>
                    <span className="font-medium">${projectReport.project.budget.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Funders:</span>
                    <span className="font-medium">{projectReport.project.investor || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Sales Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sales Rate:</span>
                    <span className="font-bold text-green-600">{projectReport.sales_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Revenue:</span>
                    <span className="font-bold text-blue-600">${projectReport.total_revenue.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Price:</span>
                    <span className="font-medium">${projectReport.average_price.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Units Sold:</span>
                    <span className="font-medium">{projectReport.sold_units} / {projectReport.total_units}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <StatGrid columns={4}>
            <StatCard label="Total Units" value={projectReport.total_units} icon={Home} color="blue" />
            <StatCard label="Units Sold" value={projectReport.sold_units} icon={TrendingUp} color="green" />
            <StatCard label="Total Revenue" value={`$${(projectReport.total_revenue / 1000000).toFixed(1)}M`} icon={DollarSign} color="teal" />
            <StatCard label="Sales Rate" value={`${projectReport.sales_rate.toFixed(1)}%`} icon={Activity} color="orange" />
          </StatGrid>

          {/* Sales Distribution Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Unit Status Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
                      <span className="text-gray-700">Sold</span>
                    </div>
                    <span className="font-semibold">{projectReport.sold_units} units</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
                      <span className="text-gray-700">Available</span>
                    </div>
                    <span className="font-semibold">{projectReport.available_units} units</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-yellow-500 rounded mr-3"></div>
                      <span className="text-gray-700">Reserved</span>
                    </div>
                    <span className="font-semibold">{projectReport.reserved_units} units</span>
                  </div>
                </div>
              </div>
              
              <div>
                {/* Visual representation */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Sold</span>
                      <span className="text-sm font-medium">{((projectReport.sold_units / projectReport.total_units) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(projectReport.sold_units / projectReport.total_units) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Available</span>
                      <span className="text-sm font-medium">{((projectReport.available_units / projectReport.total_units) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(projectReport.available_units / projectReport.total_units) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Reserved</span>
                      <span className="text-sm font-medium">{((projectReport.reserved_units / projectReport.total_units) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{ width: `${(projectReport.reserved_units / projectReport.total_units) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Sales Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Monthly Sales Trend</h2>
            <Table>
              <Table.Head>
                <Table.Tr>
                  <Table.Th>Month</Table.Th>
                  <Table.Th>Units Sold</Table.Th>
                  <Table.Th>Revenue</Table.Th>
                  <Table.Th>Avg. Price</Table.Th>
                </Table.Tr>
              </Table.Head>
              <Table.Body>
                {projectReport.monthly_sales.map((month, index) => (
                  <Table.Tr key={index}>
                    <Table.Td className="font-medium text-gray-900">{month.month}</Table.Td>
                    <Table.Td>{month.units_sold}</Table.Td>
                    <Table.Td>€{month.revenue.toLocaleString('hr-HR')}</Table.Td>
                    <Table.Td>
                      €{month.units_sold > 0 ? (month.revenue / month.units_sold).toLocaleString('hr-HR') : '0'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Body>
            </Table>
          </div>

          {/* Summary & Insights */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Summary & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Performance Highlights</h3>
                <ul className="space-y-2 text-blue-800">
                  <li>• {projectReport.sales_rate > 70 ? 'Excellent' : projectReport.sales_rate > 50 ? 'Good' : 'Needs Improvement'} sales performance at {projectReport.sales_rate.toFixed(1)}%</li>
                  <li>• Generated €{projectReport.total_revenue.toLocaleString('hr-HR')} in total revenue</li>
                  <li>• Average unit price of €{projectReport.average_price.toLocaleString('hr-HR')}</li>
                  <li>• {projectReport.available_units} units still available for sale</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">Recommendations</h3>
                <ul className="space-y-2 text-green-800">
                  {projectReport.sales_rate < 50 && <li>• Consider marketing campaigns to boost sales</li>}
                  {projectReport.available_units > projectReport.sold_units && <li>• Focus on converting leads for remaining units</li>}
                  {projectReport.reserved_units > 0 && <li>• Follow up with reserved customers to close sales</li>}
                  <li>• Analyze successful sales patterns for future projects</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Report */}
      {reportType === 'customer' && customerReport && !generatingReport && (
        <div className="space-y-6">
          {/* Customer Overview */}
          <StatGrid columns={4}>
            <StatCard label="Total Customers" value={customerReport.total_customers} icon={Users} color="blue" />
            <StatCard label="Buyers" value={customerReport.buyers} icon={TrendingUp} color="green" />
            <StatCard label="Total Revenue" value={`$${(customerReport.total_revenue / 1000000).toFixed(1)}M`} icon={DollarSign} color="teal" />
            <StatCard label="Avg. Purchase" value={`$${customerReport.average_purchase.toLocaleString()}`} icon={Activity} color="orange" />
          </StatGrid>

          {/* Customer Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Customer Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
                      <span className="text-gray-700">Buyers</span>
                    </div>
                    <span className="font-semibold">{customerReport.buyers} customers</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
                      <span className="text-gray-700">Interested</span>
                    </div>
                    <span className="font-semibold">{customerReport.interested} customers</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-yellow-500 rounded mr-3"></div>
                      <span className="text-gray-700">Leads</span>
                    </div>
                    <span className="font-semibold">{customerReport.leads} customers</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Buyers</span>
                      <span className="text-sm font-medium">{customerReport.total_customers > 0 ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1) : '0'}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${customerReport.total_customers > 0 ? (customerReport.buyers / customerReport.total_customers) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Interested</span>
                      <span className="text-sm font-medium">{customerReport.total_customers > 0 ? ((customerReport.interested / customerReport.total_customers) * 100).toFixed(1) : '0'}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${customerReport.total_customers > 0 ? (customerReport.interested / customerReport.total_customers) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Leads</span>
                      <span className="text-sm font-medium">{customerReport.total_customers > 0 ? ((customerReport.leads / customerReport.total_customers) * 100).toFixed(1) : '0'}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{ width: `${customerReport.total_customers > 0 ? (customerReport.leads / customerReport.total_customers) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Customer Summary & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Customer Highlights</h3>
                <ul className="space-y-2 text-blue-800">
                  <li>• {customerReport.total_customers} total customers in database</li>
                  <li>• {customerReport.buyers} successful conversions to buyers</li>
                  <li>• {customerReport.total_customers > 0 ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1) : '0'}% conversion rate</li>
                  <li>• ${customerReport.average_purchase.toLocaleString()} average purchase value</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">Sales Opportunities</h3>
                <ul className="space-y-2 text-green-800">
                  <li>• {customerReport.interested} interested customers to nurture</li>
                  <li>• {customerReport.leads} new leads to follow up</li>
                  <li>• Focus on converting interested customers to buyers</li>
                  <li>• Develop targeted campaigns for lead segments</li>
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