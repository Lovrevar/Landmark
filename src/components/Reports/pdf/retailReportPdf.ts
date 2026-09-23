import type { TFunction } from 'i18next'
import { yieldToUI } from '../../../utils/yieldToUI'
import { formatEuroRounded, formatDateTime } from '../../../utils/formatters'
import { loadUnicodeFont, PDF_FONT_FAMILY } from '../../../utils/pdfFont'
import { exportT, EXPORT_LANGUAGE } from '../../../utils/exportLanguage'
import { exportFileName } from '../../../utils/downloadFile'
import { logActivity } from '../../../lib/activityLog'
import type { RetailReportData } from '../retailReportTypes'

// Was a local `Intl` formatter with `style: 'currency'`, which puts the symbol last ("1.235 €");
// the shared helper puts it first ("€1.235") to match the screen. Same rounding: whole euros.
// The euro sign and the hr-HR minus sign both come from the embedded Noto Sans face.
const fmt = formatEuroRounded

/**
 * The retail portfolio report.
 *
 * Its Croatian used to be hard-coded here, which meant none of it could be reused and none of it
 * was covered by the locale parity guard — and it had drifted: `Zemljiste` and `m2` were
 * transliterations left over from the days before the font was embedded, in the one generator that
 * has always had the glyphs to spell them properly. The strings now come from the same keys the
 * retail screens render, so there is one place to fix a wording.
 *
 * `t` defaults to the export translator, which is pinned to Croatian whatever the UI language is:
 * this document goes to a bank, and the recipient's language has nothing to do with the language
 * of whoever clicked Export.
 */
export async function generateRetailReportPdf(data: RetailReportData, t: TFunction = exportT()) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')

  // No fallback: Helvetica cannot encode č/ć/đ, and jsPDF answers one unmapped character by
  // re-encoding the whole string into garbage — this report is entirely Croatian, so a fallback
  // produced a document of noise. A failure here means the font asset did not ship; let it reach
  // useAsyncExport, which tells the user.
  await loadUnicodeFont(pdf)
  const fontFamily = PDF_FONT_FAMILY

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
    pdf.setFont(fontFamily, 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text(title, margin, y)
    y += 3
    pdf.setDrawColor(37, 99, 235)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, margin + contentWidth, y)
    y += 7
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    pdf.setFont(fontFamily, 'normal')
  }

  const row = (label: string, value: string, indent = 0) => {
    checkPage(6)
    pdf.setFont(fontFamily, 'bold')
    pdf.text(label, margin + 5 + indent, y)
    pdf.setFont(fontFamily, 'normal')
    pdf.text(value, margin + contentWidth - 5, y, { align: 'right' })
    y += 5.5
  }

  /** "Plaćeno" / "Neplaćeno" — full words now that the page has room and the font has the glyphs. */
  const paidWord = t('reports.costs.paid_abbr')
  const unpaidWord = t('reports.costs.unpaid_abbr')

  const printProjectsTable = () => {
    const colWidths = [contentWidth * 0.22, contentWidth * 0.13, contentWidth * 0.13, contentWidth * 0.13, contentWidth * 0.13, contentWidth * 0.13, contentWidth * 0.13]
    const headers = [
      t('common.project'),
      t('reports.project_performance.land'),
      t('reports.portfolio.development'),
      t('reports.portfolio.construction'),
      t('reports.project_performance.revenue'),
      t('reports.project_performance.profit'),
      // An acronym, identical in both languages — the same call PROJECT_CATEGORY_LABELS gets.
      'ROI'
    ]

    checkPage(8)
    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, y - 4, contentWidth, 7, 'F')
    pdf.setFontSize(8)
    pdf.setFont(fontFamily, 'bold')

    let xPos = margin + 2
    headers.forEach((h, i) => {
      pdf.text(h, xPos, y)
      xPos += colWidths[i]
    })
    y += 6

    pdf.setFont(fontFamily, 'normal')
    data.projects.forEach(proj => {
      checkPage(7)
      xPos = margin + 2
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
        pdf.text(v, xPos, y)
        xPos += colWidths[i]
      })
      y += 5.5
    })
  }

  // Header
  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, pageWidth, 32, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.retail.pdf.title'), margin, 17)
  pdf.setFontSize(10)
  pdf.setFont(fontFamily, 'normal')
  pdf.text(`${t('common.generated')} ${formatDateTime(new Date(), EXPORT_LANGUAGE)}`, margin, 26)
  pdf.setTextColor(0, 0, 0)
  y = 42

  // Portfolio
  sectionTitle(t('reports.retail.pdf.portfolio_overview'))
  const p = data.portfolio
  row(
    t('reports.retail.pdf.total_projects'),
    `${p.total_projects} (${t('reports.portfolio.active_count', { count: p.active_projects })})`
  )
  row(
    t('reports.portfolio.land_plots'),
    t('reports.retail.pdf.land_area', {
      count: p.total_land_plots,
      area: p.total_land_area.toLocaleString('hr-HR')
    })
  )
  row(t('common.customers'), p.total_customers.toString())
  row(t('common.suppliers'), p.total_suppliers.toString())
  y += 3

  sectionTitle(t('reports.retail.pdf.financial_overview'))
  row(t('reports.retail.pdf.land_investment'), fmt(p.total_land_investment))
  row(t('reports.retail.pdf.development_cost'), fmt(p.total_development_cost))
  row(t('reports.retail.pdf.construction_cost'), fmt(p.total_construction_cost))
  row(t('reports.retail.pdf.total_costs'), fmt(p.total_costs))
  y += 2
  row(t('reports.retail.pdf.contracted_revenue'), fmt(p.total_sales_revenue))
  row(t('reports.portfolio.collected'), fmt(p.total_collected))
  row(t('reports.portfolio.outstanding'), fmt(p.total_outstanding))
  y += 2
  row(t('reports.retail.pdf.profit_total'), `${p.profit >= 0 ? '+' : ''}${fmt(p.profit)}`)
  row('ROI', `${p.roi.toFixed(1)}%`)
  row(t('reports.portfolio.avg_price_m2'), fmt(p.avg_price_per_m2))
  y += 3

  // Invoices
  sectionTitle(t('common.invoices'))
  const inv = data.invoices
  row(t('common.total_invoices'), inv.total.toString())
  row(t('common.paid'), `${inv.paid} (${fmt(inv.paid_amount)})`)
  row(t('common.pending'), `${inv.pending} (${fmt(inv.remaining_amount - inv.overdue_amount)})`)
  if (inv.overdue > 0) {
    row(t('reports.sales_analysis.overdue'), `${inv.overdue} (${fmt(inv.overdue_amount)})`)
  }
  y += 3

  // Projects
  sectionTitle(t('reports.retail.pdf.projects_overview'))
  printProjectsTable()

  // Customers
  sectionTitle(t('common.customers'))
  for (let i = 0; i < data.customers.length; i++) {
    const c = data.customers[i]
    checkPage(12)
    row(c.name, fmt(c.total_amount))
    row(`  ${paidWord} / ${unpaidWord}`, `${fmt(c.total_paid)} / ${fmt(c.total_remaining)}`, 5)
    if ((i + 1) % 25 === 0) await yieldToUI()
  }
  if (data.customers.length === 0) {
    pdf.text(t('reports.sales_analysis.no_customers'), margin + 5, y)
    y += 6
  }
  y += 3

  // Suppliers
  sectionTitle(t('reports.costs.by_supplier_type'))
  data.supplier_types.forEach(st => {
    checkPage(8)
    const unpaid = st.total_amount - st.total_paid
    row(
      `${st.type} (${t('reports.costs.contracts_count', { count: st.count })})`,
      `${fmt(st.total_amount)} / ${paidWord} ${fmt(st.total_paid)}${unpaid > 0 ? ` / ${unpaidWord} ${fmt(unpaid)}` : ''}`
    )
  })
  if (data.supplier_types.length === 0) {
    pdf.text(t('reports.costs.no_suppliers'), margin + 5, y)
    y += 6
  }
  y += 3

  // Top suppliers
  sectionTitle(t('reports.retail.pdf.top_suppliers'))
  data.suppliers.slice(0, 10).forEach(s => {
    checkPage(6)
    row(`${s.name} (${s.supplier_type})`, `${fmt(s.total_amount)} / ${paidWord} ${fmt(s.total_paid)}`)
  })

  // Footer on each page
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setTextColor(150, 150, 150)
    pdf.text(
      t('common.pdf.page_of', { page: i, total: totalPages }),
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    )
    pdf.text(t('reports.retail.pdf.footer'), margin, pageHeight - 8)
  }

  pdf.save(exportFileName('izvjestaj-retail', 'pdf'))

  logActivity({
    action: 'export.retail_pdf',
    entity: 'report',
    metadata: { severity: 'low', format: 'pdf', row_count: data.projects.length }
  })
}
