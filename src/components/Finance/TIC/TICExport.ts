import jsPDF from 'jspdf'

interface LineItem {
  name: string
  vlastita: number
  kreditna: number
}

interface Totals {
  vlastita: number
  kreditna: number
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

const formatNumberForExcel = (num: number): string => {
  return num.toFixed(2).replace('.', ',')
}

const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0
  return (value / total) * 100
}

export const exportToExcel = (
  lineItems: LineItem[],
  investorName: string,
  documentDate: string,
  totals: Totals,
  grandTotal: number
) => {
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .total-row { background-color: #e3f2fd; font-weight: bold; }
          .header-title { text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header-title">STRUKTURA TROŠKOVA INVESTICIJE (bez PDV-a)</div>
        <div style="margin-bottom: 20px;">
          <strong>INVESTITOR:</strong> ${investorName}
        </div>

        <table>
          <thead>
            <tr>
              <th rowspan="2">NAMJENA</th>
              <th colspan="2" class="text-center">VLASTITA SREDSTVA</th>
              <th colspan="2" class="text-center">KREDITNA SREDSTVA</th>
              <th rowspan="2" class="text-center">UKUPNA INVESTICIJA<br>EUR</th>
            </tr>
            <tr>
              <th class="text-center">EUR</th>
              <th class="text-center">(%)</th>
              <th class="text-center">EUR</th>
              <th class="text-center">(%)</th>
            </tr>
          </thead>
          <tbody>
  `

  lineItems.forEach((item) => {
    const rowTotal = item.vlastita + item.kreditna
    const vlastitaPercent = calculatePercentage(item.vlastita, rowTotal)
    const kreditnaPercent = calculatePercentage(item.kreditna, rowTotal)

    html += `
      <tr>
        <td>${item.name}</td>
        <td class="text-right">${formatNumberForExcel(item.vlastita)}</td>
        <td class="text-right">${formatNumberForExcel(vlastitaPercent)}%</td>
        <td class="text-right">${formatNumberForExcel(item.kreditna)}</td>
        <td class="text-right">${formatNumberForExcel(kreditnaPercent)}%</td>
        <td class="text-right">${formatNumberForExcel(rowTotal)}</td>
      </tr>
    `
  })

  const vlastitaTotalPercent = calculatePercentage(totals.vlastita, grandTotal)
  const kreditnaTotalPercent = calculatePercentage(totals.kreditna, grandTotal)

  html += `
            <tr class="total-row">
              <td><strong>UKUPNO:</strong></td>
              <td class="text-right"><strong>${formatNumberForExcel(totals.vlastita)}</strong></td>
              <td class="text-right"><strong>${formatNumberForExcel(vlastitaTotalPercent)}%</strong></td>
              <td class="text-right"><strong>${formatNumberForExcel(totals.kreditna)}</strong></td>
              <td class="text-right"><strong>${formatNumberForExcel(kreditnaTotalPercent)}%</strong></td>
              <td class="text-right"><strong>${formatNumberForExcel(grandTotal)}</strong></td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px;">
          <p><strong>Za investitora:</strong> _________________________</p>
          <p><strong>Datum:</strong> ${documentDate}</p>
        </div>
      </body>
    </html>
  `

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `TIC_Struktura_Troskova_${documentDate}.xls`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportToPDF = (
  lineItems: LineItem[],
  investorName: string,
  documentDate: string,
  totals: Totals,
  grandTotal: number
) => {
  const pdf = new jsPDF('landscape', 'mm', 'a4')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('STRUKTURA TROŠKOVA INVESTICIJE (bez PDV-a)', 148, 20, { align: 'center' })

  pdf.setFontSize(11)
  pdf.text(`INVESTITOR: ${investorName}`, 20, 35)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)

  const startY = 50
  const rowHeight = 7
  const colWidths = [70, 28, 20, 28, 20, 28]
  let currentY = startY

  pdf.rect(20, currentY, colWidths.reduce((a, b) => a + b), rowHeight)
  pdf.text('NAMJENA', 22, currentY + 5)
  pdf.text('VLASTITA SREDSTVA', 110, currentY + 5, { align: 'center' })
  pdf.text('KREDITNA SREDSTVA', 166, currentY + 5, { align: 'center' })
  pdf.text('UKUPNO', 207, currentY + 5, { align: 'center' })

  currentY += rowHeight

  let xPos = 20
  pdf.rect(xPos, currentY, colWidths[0], rowHeight)
  xPos += colWidths[0]

  pdf.rect(xPos, currentY, colWidths[1], rowHeight)
  pdf.text('EUR', xPos + colWidths[1] / 2, currentY + 5, { align: 'center' })
  xPos += colWidths[1]

  pdf.rect(xPos, currentY, colWidths[2], rowHeight)
  pdf.text('(%)', xPos + colWidths[2] / 2, currentY + 5, { align: 'center' })
  xPos += colWidths[2]

  pdf.rect(xPos, currentY, colWidths[3], rowHeight)
  pdf.text('EUR', xPos + colWidths[3] / 2, currentY + 5, { align: 'center' })
  xPos += colWidths[3]

  pdf.rect(xPos, currentY, colWidths[4], rowHeight)
  pdf.text('(%)', xPos + colWidths[4] / 2, currentY + 5, { align: 'center' })
  xPos += colWidths[4]

  pdf.rect(xPos, currentY, colWidths[5], rowHeight)
  pdf.text('EUR', xPos + colWidths[5] / 2, currentY + 5, { align: 'center' })

  currentY += rowHeight

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)

  lineItems.forEach((item) => {
    const rowTotal = item.vlastita + item.kreditna
    const vlastitaPercent = calculatePercentage(item.vlastita, rowTotal)
    const kreditnaPercent = calculatePercentage(item.kreditna, rowTotal)

    xPos = 20

    pdf.rect(xPos, currentY, colWidths[0], rowHeight)
    pdf.text(item.name.substring(0, 45), xPos + 2, currentY + 5)
    xPos += colWidths[0]

    pdf.rect(xPos, currentY, colWidths[1], rowHeight)
    pdf.text(formatNumberForExcel(item.vlastita), xPos + colWidths[1] - 2, currentY + 5, { align: 'right' })
    xPos += colWidths[1]

    pdf.rect(xPos, currentY, colWidths[2], rowHeight)
    pdf.text(formatNumberForExcel(vlastitaPercent) + '%', xPos + colWidths[2] - 2, currentY + 5, { align: 'right' })
    xPos += colWidths[2]

    pdf.rect(xPos, currentY, colWidths[3], rowHeight)
    pdf.text(formatNumberForExcel(item.kreditna), xPos + colWidths[3] - 2, currentY + 5, { align: 'right' })
    xPos += colWidths[3]

    pdf.rect(xPos, currentY, colWidths[4], rowHeight)
    pdf.text(formatNumberForExcel(kreditnaPercent) + '%', xPos + colWidths[4] - 2, currentY + 5, { align: 'right' })
    xPos += colWidths[4]

    pdf.rect(xPos, currentY, colWidths[5], rowHeight)
    pdf.text(formatNumberForExcel(rowTotal), xPos + colWidths[5] - 2, currentY + 5, { align: 'right' })

    currentY += rowHeight
  })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)

  const vlastitaTotalPercent = calculatePercentage(totals.vlastita, grandTotal)
  const kreditnaTotalPercent = calculatePercentage(totals.kreditna, grandTotal)

  xPos = 20

  pdf.setFillColor(227, 242, 253)
  pdf.rect(xPos, currentY, colWidths.reduce((a, b) => a + b), rowHeight, 'FD')

  pdf.rect(xPos, currentY, colWidths[0], rowHeight)
  pdf.text('UKUPNO:', xPos + 2, currentY + 5)
  xPos += colWidths[0]

  pdf.rect(xPos, currentY, colWidths[1], rowHeight)
  pdf.text(formatNumberForExcel(totals.vlastita), xPos + colWidths[1] - 2, currentY + 5, { align: 'right' })
  xPos += colWidths[1]

  pdf.rect(xPos, currentY, colWidths[2], rowHeight)
  pdf.text(formatNumberForExcel(vlastitaTotalPercent) + '%', xPos + colWidths[2] - 2, currentY + 5, { align: 'right' })
  xPos += colWidths[2]

  pdf.rect(xPos, currentY, colWidths[3], rowHeight)
  pdf.text(formatNumberForExcel(totals.kreditna), xPos + colWidths[3] - 2, currentY + 5, { align: 'right' })
  xPos += colWidths[3]

  pdf.rect(xPos, currentY, colWidths[4], rowHeight)
  pdf.text(formatNumberForExcel(kreditnaTotalPercent) + '%', xPos + colWidths[4] - 2, currentY + 5, { align: 'right' })
  xPos += colWidths[4]

  pdf.rect(xPos, currentY, colWidths[5], rowHeight)
  pdf.text(formatNumberForExcel(grandTotal), xPos + colWidths[5] - 2, currentY + 5, { align: 'right' })

  currentY += rowHeight + 15

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Za investitora: _________________________', 20, currentY)
  currentY += 10
  pdf.text(`Datum: ${documentDate}`, 20, currentY)

  pdf.save(`TIC_Struktura_Troskova_${documentDate}.pdf`)
}
