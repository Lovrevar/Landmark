import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  const pdf = new jsPDF('landscape', 'mm', 'a4')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('STRUKTURA TROŠKOVA INVESTICIJE (bez PDV-a)', 148, 20, { align: 'center' })

  let currentHeaderY = 30
  if (projectName) {
    pdf.setFontSize(12)
    pdf.text(`Projekt: ${projectName}`, 148, currentHeaderY, { align: 'center' })
    currentHeaderY += 10
  }

  pdf.setFontSize(11)
  pdf.text(`INVESTITOR: ${investorName}`, 20, currentHeaderY + 5)

  const startY = projectName ? 55 : 50

  const vlastitaTotalPercent = calculatePercentage(totals.vlastita, grandTotal)
  const kreditnaTotalPercent = calculatePercentage(totals.kreditna, grandTotal)

  const tableBody = lineItems.map((item) => {
    const rowTotal = item.vlastita + item.kreditna
    const vlastitaPercent = calculatePercentage(item.vlastita, grandTotal)
    const kreditnaPercent = calculatePercentage(item.kreditna, grandTotal)

    return [
      item.name,
      formatNumberForExcel(item.vlastita),
      formatNumberForExcel(vlastitaPercent) + '%',
      formatNumberForExcel(item.kreditna),
      formatNumberForExcel(kreditnaPercent) + '%',
      formatNumberForExcel(rowTotal),
    ]
  })

  autoTable(pdf, {
    startY: startY,
    head: [
      [
        { content: 'NAMJENA', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'VLASTITA SREDSTVA', colSpan: 2, styles: { halign: 'center' } },
        { content: 'KREDITNA SREDSTVA', colSpan: 2, styles: { halign: 'center' } },
        { content: 'UKUPNA INVESTICIJA', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      ],
      ['', 'EUR', '(%)', 'EUR', '(%)', 'EUR'],
    ],
    body: tableBody,
    foot: [
      [
        'UKUPNO:',
        formatNumberForExcel(totals.vlastita),
        formatNumberForExcel(vlastitaTotalPercent) + '%',
        formatNumberForExcel(totals.kreditna),
        formatNumberForExcel(kreditnaTotalPercent) + '%',
        formatNumberForExcel(grandTotal),
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    footStyles: {
      fillColor: [227, 242, 253],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'left' },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 20 },
  })

  const finalY = (pdf as any).lastAutoTable.finalY || startY + 100

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Za investitora: _________________________', 20, finalY + 15)
  pdf.text(`Datum: ${documentDate}`, 20, finalY + 25)

  const pdfFileName = projectName
    ? `TIC_${projectName.replace(/\s+/g, '_')}_${documentDate}.pdf`
    : `TIC_Struktura_Troskova_${documentDate}.pdf`
  pdf.save(pdfFileName)
}
