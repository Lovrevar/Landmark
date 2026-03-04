import { format } from 'date-fns'
import type { ProjectSalesReport, CustomerReport } from '../types'

export async function generateSalesReportPDF(
  reportType: 'project' | 'customer',
  projectReport: ProjectSalesReport | null,
  customerReport: CustomerReport | null,
  dateRange: { start: string; end: string }
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  const footerHeight = 15

  const addFooter = () => {
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(107, 114, 128)
      pdf.text('LANDMARK GROUP - Sales Report', margin, pageHeight - 10)
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 25, pageHeight - 10)
    }
  }

  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - footerHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

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

    pdf.setFontSize(10)
    pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, yPosition)
    pdf.text(`Report Period: ${format(new Date(dateRange.start), 'MMM dd, yyyy')} - ${format(new Date(dateRange.end), 'MMM dd, yyyy')}`, margin, yPosition + 5)
    yPosition += 20

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

    overviewData.forEach(([label, value]) => {
      checkPageBreak(6)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + 5, yPosition)
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + 60, yPosition)
      yPosition += 6
    })

    yPosition += 15

    checkPageBreak(40)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    yPosition = addText('Monthly Sales Performance', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 10

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    projectReport.monthly_sales.forEach((month) => {
      checkPageBreak(6)
      pdf.text(`${month.month}:`, margin + 5, yPosition)
      pdf.text(`${month.units_sold} units sold`, margin + 40, yPosition)
      pdf.text(`$${month.revenue.toLocaleString('hr-HR')} revenue`, margin + 80, yPosition)
      yPosition += 6
    })

    yPosition += 15

    checkPageBreak(40)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    yPosition = addText('Apartment Details', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 10

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')

    projectReport.apartments.forEach((apt) => {
      checkPageBreak(8)
      const statusColor = apt.status === 'Sold' ? [34, 197, 94] : apt.status === 'Reserved' ? [245, 158, 11] : [59, 130, 246]

      pdf.text(`Unit ${apt.number} (Floor ${apt.floor}):`, margin + 5, yPosition)
      pdf.text(`${apt.size_m2}m²`, margin + 50, yPosition)
      pdf.text(`$${apt.price.toLocaleString('hr-HR')}`, margin + 80, yPosition)

      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
      pdf.setFont('helvetica', 'bold')
      pdf.text(apt.status, margin + 120, yPosition)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont('helvetica', 'normal')

      if (apt.buyer_name) {
        pdf.text(`(${apt.buyer_name})`, margin + 145, yPosition)
      }
      yPosition += 8
    })

  } else if (reportType === 'customer' && customerReport) {
    pdf.setFillColor(37, 99, 235)
    pdf.rect(0, 0, pageWidth, 35, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('LANDMARK GROUP Customer Report', margin, 20)

    pdf.setTextColor(0, 0, 0)
    yPosition = 45

    pdf.setFontSize(10)
    pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, yPosition)
    pdf.text(`Report Period: ${format(new Date(dateRange.start), 'MMM dd, yyyy')} - ${format(new Date(dateRange.end), 'MMM dd, yyyy')}`, margin, yPosition + 5)
    yPosition += 20

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

    customerOverviewData.forEach(([label, value]) => {
      checkPageBreak(6)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + 5, yPosition)
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + 60, yPosition)
      yPosition += 6
    })

    yPosition += 15

    checkPageBreak(20)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    yPosition = addText('Customer Details', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 10

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')

    customerReport.customers.forEach((customer) => {
      checkPageBreak(8)
      const statusColor = customer.status === 'buyer' ? [34, 197, 94] : customer.status === 'interested' ? [59, 130, 246] : [245, 158, 11]

      pdf.text(`${customer.name} ${customer.surname}`, margin + 5, yPosition)
      pdf.text(customer.email, margin + 60, yPosition)
      pdf.text(customer.phone || 'No phone', margin + 120, yPosition)

      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
      pdf.setFont('helvetica', 'bold')
      pdf.text(customer.status.toUpperCase(), margin + 160, yPosition)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont('helvetica', 'normal')
      yPosition += 8
    })
  }

  addFooter()

  const fileName = `${reportType === 'project' ? 'Sales' : 'Customer'}_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(fileName)
}
