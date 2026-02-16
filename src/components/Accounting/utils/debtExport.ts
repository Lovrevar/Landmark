import { DebtSummary } from '../types/debtTypes'
import { formatEuropeanNumber } from '../services/debtService'

const getSupplierTypeText = (type: string) => {
  switch (type) {
    case 'retail_supplier':
      return 'Retail'
    case 'office_supplier':
      return 'Office'
    case 'mixed':
      return 'Mixed'
    default:
      return 'Site'
  }
}

export const exportToExcel = (
  sortedData: DebtSummary[],
  totalUnpaid: number,
  totalPaid: number,
  projectName?: string | null
) => {
  const headers = ['Firma', 'Tip', 'Računi', 'Neisplaćeno (€)', 'Isplaćeno (€)', 'Ukupno (€)']

  const rows = sortedData.map(debt => [
    debt.supplier_name,
    getSupplierTypeText(debt.supplier_type),
    debt.invoice_count.toString(),
    formatEuropeanNumber(debt.total_unpaid),
    formatEuropeanNumber(debt.total_paid),
    formatEuropeanNumber(debt.total_unpaid + debt.total_paid)
  ])

  rows.push([
    'UKUPNO',
    '',
    '',
    formatEuropeanNumber(totalUnpaid),
    formatEuropeanNumber(totalPaid),
    formatEuropeanNumber(totalUnpaid + totalPaid)
  ])

  const htmlContent = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Stanje duga</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <style>
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #4B5563; color: white; font-weight: bold; padding: 12px; text-align: left; border: 1px solid #ddd; }
          td { padding: 10px; border: 1px solid #ddd; text-align: left; }
          tr:nth-child(even) { background-color: #f9fafb; }
          tr:last-child { font-weight: bold; background-color: #e5e7eb; }
          .number { text-align: right; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${row[0]}</td>
                <td>${row[1]}</td>
                <td class="number">${row[2]}</td>
                <td class="number">${row[3]}</td>
                <td class="number">${row[4]}</td>
                <td class="number">${row[5]}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  const projectSuffix = projectName ? `_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}` : ''
  const fileName = `stanje_duga${projectSuffix}_${new Date().toISOString().split('T')[0]}.xls`

  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportToPDF = async (
  sortedData: DebtSummary[],
  totalUnpaid: number,
  totalPaid: number,
  totalSuppliers: number,
  suppliersWithDebt: number,
  projectName?: string | null
) => {
  const jsPDF = (await import('jspdf')).default
  const doc = new jsPDF()

  const normalizeText = (text: string) => {
    return text
      .replace(/č/g, 'c').replace(/Č/g, 'C')
      .replace(/ć/g, 'c').replace(/Ć/g, 'C')
      .replace(/š/g, 's').replace(/Š/g, 'S')
      .replace(/ž/g, 'z').replace(/Ž/g, 'Z')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  const title = projectName ? `Stanje duga - ${normalizeText(projectName)}` : 'Stanje duga'
  doc.text(title, 105, 20, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Izvjestaj generiran: ${new Date().toLocaleDateString('hr-HR')}`, 105, 28, { align: 'center' })

  let yPosition = 40

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ukupno dobavljaca: ${totalSuppliers}`, 20, yPosition)
  yPosition += 6
  doc.text(`Dobavljaci s dugom: ${suppliersWithDebt}`, 20, yPosition)
  yPosition += 6
  doc.text(`Ukupno neisplaceno: EUR ${formatEuropeanNumber(totalUnpaid)}`, 20, yPosition)
  yPosition += 6
  doc.text(`Ukupno isplaceno: EUR ${formatEuropeanNumber(totalPaid)}`, 20, yPosition)

  yPosition = 65

  const tableStartX = 14
  const tableWidth = 182
  const colWidths = [70, 20, 20, 24, 24, 24]
  const rowHeight = 8

  doc.setFillColor(75, 85, 99)
  doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)

  let xPos = tableStartX + 2
  doc.text('Firma', xPos, yPosition + 5.5)
  xPos += colWidths[0]
  doc.text('Tip', xPos, yPosition + 5.5)
  xPos += colWidths[1]
  doc.text('Racuni', xPos, yPosition + 5.5)
  xPos += colWidths[2]
  doc.text('Neisplaceno', xPos, yPosition + 5.5)
  xPos += colWidths[3]
  doc.text('Isplaceno', xPos, yPosition + 5.5)
  xPos += colWidths[4]
  doc.text('Ukupno', xPos, yPosition + 5.5)

  yPosition += rowHeight

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  let isEvenRow = false

  sortedData.forEach((debt) => {
    if (yPosition > 270) {
      doc.addPage()
      yPosition = 20

      doc.setFillColor(75, 85, 99)
      doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)

      let xPos = tableStartX + 2
      doc.text('Firma', xPos, yPosition + 5.5)
      xPos += colWidths[0]
      doc.text('Tip', xPos, yPosition + 5.5)
      xPos += colWidths[1]
      doc.text('Racuni', xPos, yPosition + 5.5)
      xPos += colWidths[2]
      doc.text('Neisplaceno', xPos, yPosition + 5.5)
      xPos += colWidths[3]
      doc.text('Isplaceno', xPos, yPosition + 5.5)
      xPos += colWidths[4]
      doc.text('Ukupno', xPos, yPosition + 5.5)

      yPosition += rowHeight
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      isEvenRow = false
    }

    if (isEvenRow) {
      doc.setFillColor(249, 250, 251)
      doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F')
    }

    doc.setDrawColor(221, 221, 221)
    doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'S')

    for (let i = 0; i < colWidths.length - 1; i++) {
      const lineX = tableStartX + colWidths.slice(0, i + 1).reduce((a, b) => a + b, 0)
      doc.line(lineX, yPosition, lineX, yPosition + rowHeight)
    }

    let xPos = tableStartX + 2
    const firmName = normalizeText(debt.supplier_name)
    const truncatedName = firmName.length > 32 ? firmName.substring(0, 29) + '...' : firmName
    doc.text(truncatedName, xPos, yPosition + 5.5)

    xPos += colWidths[0]
    doc.text(getSupplierTypeText(debt.supplier_type), xPos, yPosition + 5.5)

    xPos += colWidths[1]
    doc.text(debt.invoice_count.toString(), xPos + colWidths[2] - 2, yPosition + 5.5, { align: 'right' })

    xPos += colWidths[2]
    doc.text(formatEuropeanNumber(debt.total_unpaid), xPos + colWidths[3] - 2, yPosition + 5.5, { align: 'right' })

    xPos += colWidths[3]
    doc.text(formatEuropeanNumber(debt.total_paid), xPos + colWidths[4] - 2, yPosition + 5.5, { align: 'right' })

    xPos += colWidths[4]
    doc.text(formatEuropeanNumber(debt.total_unpaid + debt.total_paid), xPos + colWidths[5] - 2, yPosition + 5.5, { align: 'right' })

    yPosition += rowHeight
    isEvenRow = !isEvenRow
  })

  if (yPosition > 265) {
    doc.addPage()
    yPosition = 20
  }

  doc.setFillColor(229, 231, 235)
  doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F')
  doc.setDrawColor(221, 221, 221)
  doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'S')

  for (let i = 0; i < colWidths.length - 1; i++) {
    const lineX = tableStartX + colWidths.slice(0, i + 1).reduce((a, b) => a + b, 0)
    doc.line(lineX, yPosition, lineX, yPosition + rowHeight)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('UKUPNO', tableStartX + 2, yPosition + 5.5)

  let totalXPos = tableStartX + colWidths[0] + colWidths[1] + colWidths[2]
  doc.text(formatEuropeanNumber(totalUnpaid), totalXPos + colWidths[3] - 2, yPosition + 5.5, { align: 'right' })

  totalXPos += colWidths[3]
  doc.text(formatEuropeanNumber(totalPaid), totalXPos + colWidths[4] - 2, yPosition + 5.5, { align: 'right' })

  totalXPos += colWidths[4]
  doc.text(formatEuropeanNumber(totalUnpaid + totalPaid), totalXPos + colWidths[5] - 2, yPosition + 5.5, { align: 'right' })

  const projectSuffix = projectName ? `_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}` : ''
  const fileName = `stanje_duga${projectSuffix}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}
