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
  grandTotal: number,
  projectName?: string
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
        ${projectName ? `<div style="text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 10px;">Projekt: ${projectName}</div>` : ''}
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
    const vlastitaPercent = calculatePercentage(item.vlastita, grandTotal)
    const kreditnaPercent = calculatePercentage(item.kreditna, grandTotal)

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
  const fileName = projectName
    ? `TIC_${projectName.replace(/\s+/g, '_')}_${documentDate}.xls`
    : `TIC_Struktura_Troskova_${documentDate}.xls`
  link.download = fileName
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
  grandTotal: number,
  projectName?: string
) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const pageWidth = 297
  const pageHeight = 210
  const scale = 4

  canvas.width = pageWidth * scale
  canvas.height = pageHeight * scale

  ctx.scale(scale, scale)
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, pageWidth, pageHeight)

  ctx.fillStyle = 'black'
  ctx.font = 'bold 14px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('STRUKTURA TROŠKOVA INVESTICIJE (bez PDV-a)', pageWidth / 2, 18)

  let currentHeaderY = 28
  if (projectName) {
    ctx.font = 'bold 12px Arial, sans-serif'
    ctx.fillText(`Projekt: ${projectName}`, pageWidth / 2, currentHeaderY)
    currentHeaderY += 8
  }

  ctx.font = 'bold 10px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`INVESTITOR: ${investorName}`, 20, currentHeaderY + 5)

  const startY = projectName ? 52 : 48
  const rowHeight = 7
  const colWidths = [75, 30, 22, 30, 22, 30]
  let currentY = startY

  ctx.strokeStyle = 'black'
  ctx.lineWidth = 0.3

  ctx.strokeRect(20, currentY, colWidths[0], rowHeight * 2)
  ctx.font = 'bold 7px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('NAMJENA', 22, currentY + 9)

  let xPos = 20 + colWidths[0]
  const headerCols = [
    { width: colWidths[1] + colWidths[2], text: 'VLASTITA SREDSTVA' },
    { width: colWidths[3] + colWidths[4], text: 'KREDITNA SREDSTVA' },
    { width: colWidths[5], text: 'UKUPNO' }
  ]

  ctx.textAlign = 'center'
  ctx.font = 'bold 7px Arial, sans-serif'
  headerCols.forEach(col => {
    ctx.strokeRect(xPos, currentY, col.width, rowHeight)
    ctx.fillText(col.text, xPos + col.width / 2, currentY + 4.5)
    xPos += col.width
  })

  currentY += rowHeight

  xPos = 20 + colWidths[0]
  ctx.strokeRect(xPos, currentY, colWidths[1], rowHeight)
  ctx.fillText('EUR', xPos + colWidths[1] / 2, currentY + 4.5)
  xPos += colWidths[1]

  ctx.strokeRect(xPos, currentY, colWidths[2], rowHeight)
  ctx.fillText('(%)', xPos + colWidths[2] / 2, currentY + 4.5)
  xPos += colWidths[2]

  ctx.strokeRect(xPos, currentY, colWidths[3], rowHeight)
  ctx.fillText('EUR', xPos + colWidths[3] / 2, currentY + 4.5)
  xPos += colWidths[3]

  ctx.strokeRect(xPos, currentY, colWidths[4], rowHeight)
  ctx.fillText('(%)', xPos + colWidths[4] / 2, currentY + 4.5)
  xPos += colWidths[4]

  ctx.strokeRect(xPos, currentY, colWidths[5], rowHeight)
  ctx.fillText('EUR', xPos + colWidths[5] / 2, currentY + 4.5)

  currentY += rowHeight

  ctx.font = 'normal 6px Arial, sans-serif'

  lineItems.forEach((item) => {
    const rowTotal = item.vlastita + item.kreditna
    const vlastitaPercent = calculatePercentage(item.vlastita, grandTotal)
    const kreditnaPercent = calculatePercentage(item.kreditna, grandTotal)

    xPos = 20

    ctx.strokeRect(xPos, currentY, colWidths[0], rowHeight)
    ctx.textAlign = 'left'
    const itemName = item.name.length > 45 ? item.name.substring(0, 42) + '...' : item.name
    ctx.fillText(itemName, xPos + 1.5, currentY + 5)
    xPos += colWidths[0]

    ctx.textAlign = 'right'
    ctx.strokeRect(xPos, currentY, colWidths[1], rowHeight)
    ctx.fillText(formatNumberForExcel(item.vlastita), xPos + colWidths[1] - 1.5, currentY + 5)
    xPos += colWidths[1]

    ctx.strokeRect(xPos, currentY, colWidths[2], rowHeight)
    ctx.fillText(formatNumberForExcel(vlastitaPercent) + '%', xPos + colWidths[2] - 1.5, currentY + 5)
    xPos += colWidths[2]

    ctx.strokeRect(xPos, currentY, colWidths[3], rowHeight)
    ctx.fillText(formatNumberForExcel(item.kreditna), xPos + colWidths[3] - 1.5, currentY + 5)
    xPos += colWidths[3]

    ctx.strokeRect(xPos, currentY, colWidths[4], rowHeight)
    ctx.fillText(formatNumberForExcel(kreditnaPercent) + '%', xPos + colWidths[4] - 1.5, currentY + 5)
    xPos += colWidths[4]

    ctx.strokeRect(xPos, currentY, colWidths[5], rowHeight)
    ctx.fillText(formatNumberForExcel(rowTotal), xPos + colWidths[5] - 1.5, currentY + 5)

    currentY += rowHeight
  })

  ctx.font = 'bold 7px Arial, sans-serif'

  const vlastitaTotalPercent = calculatePercentage(totals.vlastita, grandTotal)
  const kreditnaTotalPercent = calculatePercentage(totals.kreditna, grandTotal)

  xPos = 20

  ctx.fillStyle = 'rgba(227, 242, 253, 1)'
  ctx.fillRect(xPos, currentY, colWidths.reduce((a, b) => a + b), rowHeight)
  ctx.fillStyle = 'black'

  ctx.strokeRect(xPos, currentY, colWidths[0], rowHeight)
  ctx.textAlign = 'left'
  ctx.fillText('UKUPNO:', xPos + 1.5, currentY + 5)
  xPos += colWidths[0]

  ctx.textAlign = 'right'
  ctx.strokeRect(xPos, currentY, colWidths[1], rowHeight)
  ctx.fillText(formatNumberForExcel(totals.vlastita), xPos + colWidths[1] - 1.5, currentY + 5)
  xPos += colWidths[1]

  ctx.strokeRect(xPos, currentY, colWidths[2], rowHeight)
  ctx.fillText(formatNumberForExcel(vlastitaTotalPercent) + '%', xPos + colWidths[2] - 1.5, currentY + 5)
  xPos += colWidths[2]

  ctx.strokeRect(xPos, currentY, colWidths[3], rowHeight)
  ctx.fillText(formatNumberForExcel(totals.kreditna), xPos + colWidths[3] - 1.5, currentY + 5)
  xPos += colWidths[3]

  ctx.strokeRect(xPos, currentY, colWidths[4], rowHeight)
  ctx.fillText(formatNumberForExcel(kreditnaTotalPercent) + '%', xPos + colWidths[4] - 1.5, currentY + 5)
  xPos += colWidths[4]

  ctx.strokeRect(xPos, currentY, colWidths[5], rowHeight)
  ctx.fillText(formatNumberForExcel(grandTotal), xPos + colWidths[5] - 1.5, currentY + 5)

  currentY += rowHeight + 12

  ctx.font = 'normal 9px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Za investitora: _________________________', 20, currentY)
  currentY += 8
  ctx.fillText(`Datum: ${documentDate}`, 20, currentY)

  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF('landscape', 'mm', 'a4')
  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, '', 'FAST')

  const pdfFileName = projectName
    ? `TIC_${projectName.replace(/\s+/g, '_')}_${documentDate}.pdf`
    : `TIC_Struktura_Troskova_${documentDate}.pdf`
  pdf.save(pdfFileName)
}
