import { format } from 'date-fns'
import type { RetailReportData } from './retailReportTypes'

const fmt = (n: number) => new Intl.NumberFormat('hr-HR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}).format(n)

export async function generateRetailReportPdf(data: RetailReportData) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPage = (need: number) => {
    if (y + need > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  }

  const sectionTitle = (title: string) => {
    checkPage(20)
    y += 5
    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text(title, margin, y)
    y += 3
    pdf.setDrawColor(37, 99, 235)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, margin + contentWidth, y)
    y += 7
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
  }

  const row = (label: string, value: string, indent = 0) => {
    checkPage(6)
    pdf.setFont('helvetica', 'bold')
    pdf.text(label, margin + 5 + indent, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(value, margin + contentWidth - 5, y, { align: 'right' })
    y += 5.5
  }

  // Header
  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, pageWidth, 32, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Retail izvjestaj', margin, 17)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Generirano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, margin, 26)
  pdf.setTextColor(0, 0, 0)
  y = 42

  // Portfolio
  sectionTitle('Portfelj - Pregled')
  const p = data.portfolio
  row('Ukupno projekata', `${p.total_projects} (${p.active_projects} aktivnih)`)
  row('Zemljista', `${p.total_land_plots} parcela, ${p.total_land_area.toLocaleString('hr-HR')} m2`)
  row('Kupci', p.total_customers.toString())
  row('Dobavljaci', p.total_suppliers.toString())
  y += 3

  sectionTitle('Financijski pregled')
  row('Investicija u zemljista', fmt(p.total_land_investment))
  row('Troskovi razvoja', fmt(p.total_development_cost))
  row('Troskovi gradnje', fmt(p.total_construction_cost))
  row('UKUPNI TROSKOVI', fmt(p.total_costs))
  y += 2
  row('Ugovoreni prihod', fmt(p.total_sales_revenue))
  row('Naplaceno', fmt(p.total_collected))
  row('Za naplatu', fmt(p.total_outstanding))
  y += 2
  row('PROFIT', `${p.profit >= 0 ? '+' : ''}${fmt(p.profit)}`)
  row('ROI', `${p.roi.toFixed(1)}%`)
  row('Prosjecna cijena/m2', fmt(p.avg_price_per_m2))
  y += 3

  // Invoices
  sectionTitle('Racuni')
  const inv = data.invoices
  row('Ukupno racuna', inv.total.toString())
  row('Placeno', `${inv.paid} (${fmt(inv.paid_amount)})`)
  row('Na cekanju', `${inv.pending} (${fmt(inv.remaining_amount - inv.overdue_amount)})`)
  if (inv.overdue > 0) {
    row('U kasnjenju', `${inv.overdue} (${fmt(inv.overdue_amount)})`)
  }
  y += 3

  // Projects
  sectionTitle('Projekti - Pregled')
  printProjectsTable(pdf, data, margin, contentWidth, y, checkPage)
  y = getCurrentY()

  // Customers
  sectionTitle('Kupci')
  data.customers.forEach(c => {
    checkPage(12)
    row(c.name, fmt(c.total_amount))
    row('  Placeno / Neplaceno', `${fmt(c.total_paid)} / ${fmt(c.total_remaining)}`, 5)
  })
  if (data.customers.length === 0) {
    pdf.text('Nema podataka o kupcima', margin + 5, y)
    y += 6
  }
  y += 3

  // Suppliers
  sectionTitle('Dobavljaci po tipu')
  data.supplier_types.forEach(st => {
    checkPage(8)
    const unpaid = st.total_amount - st.total_paid
    row(`${st.type} (${st.count} ugovora)`, `${fmt(st.total_amount)} / Plac. ${fmt(st.total_paid)}${unpaid > 0 ? ` / Nepl. ${fmt(unpaid)}` : ''}`)
  })
  if (data.supplier_types.length === 0) {
    pdf.text('Nema podataka o dobavljacima', margin + 5, y)
    y += 6
  }
  y += 3

  // Top suppliers
  sectionTitle('Top dobavljaci')
  data.suppliers.slice(0, 10).forEach(s => {
    checkPage(6)
    row(`${s.name} (${s.supplier_type})`, `${fmt(s.total_amount)} / Plac. ${fmt(s.total_paid)}`)
  })

  // Footer on each page
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setTextColor(150, 150, 150)
    pdf.text(`Stranica ${i} od ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    pdf.text('Retail izvjestaj - Povjerljivo', margin, pageHeight - 8)
  }

  pdf.save(`retail-izvjestaj-${format(new Date(), 'yyyy-MM-dd')}.pdf`)

  let _currentY = y
  function getCurrentY() { return _currentY }

  function printProjectsTable(
    doc: typeof pdf,
    reportData: typeof data,
    m: number,
    cw: number,
    startY: number,
    check: (n: number) => void
  ) {
    let ty = startY

    const colWidths = [cw * 0.22, cw * 0.13, cw * 0.13, cw * 0.13, cw * 0.13, cw * 0.13, cw * 0.13]
    const headers = ['Projekt', 'Zemljiste', 'Razvoj', 'Gradnja', 'Prihod', 'Profit', 'ROI']

    check(8)
    doc.setFillColor(240, 240, 240)
    doc.rect(m, ty - 4, cw, 7, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')

    let xPos = m + 2
    headers.forEach((h, i) => {
      doc.text(h, xPos, ty)
      xPos += colWidths[i]
    })
    ty += 6

    doc.setFont('helvetica', 'normal')
    reportData.projects.forEach(proj => {
      check(7)
      xPos = m + 2
      const vals = [
        proj.name.substring(0, 18),
        fmt(proj.land_cost),
        fmt(proj.development.budget_realized),
        fmt(proj.construction.budget_realized),
        fmt(proj.total_revenue),
        `${proj.profit >= 0 ? '+' : ''}${fmt(proj.profit)}`,
        `${proj.roi.toFixed(1)}%`
      ]
      vals.forEach((v, i) => {
        doc.text(v, xPos, ty)
        xPos += colWidths[i]
      })
      ty += 5.5
    })

    _currentY = ty
  }
}
