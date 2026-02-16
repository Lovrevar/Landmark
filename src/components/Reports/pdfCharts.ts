import { jsPDF } from 'jspdf'

export const drawBarChart = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Array<{ label: string; value: number }>,
  options: {
    title?: string
    color?: string
    showValues?: boolean
    maxValue?: number
  } = {}
) => {
  const { title, color = '#2563eb', showValues = true, maxValue } = options
  const barColor = hexToRgb(color)

  if (title) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, x, y - 3)
  }

  pdf.setDrawColor(200, 200, 200)
  pdf.rect(x, y, width, height)

  if (data.length === 0) return

  const max = maxValue || Math.max(...data.map(d => d.value))
  const barWidth = width / data.length - 2
  const scale = height / max

  data.forEach((item, index) => {
    const barHeight = item.value * scale
    const barX = x + (index * (width / data.length)) + 1
    const barY = y + height - barHeight

    pdf.setFillColor(barColor.r, barColor.g, barColor.b)
    pdf.rect(barX, barY, barWidth, barHeight, 'F')

    pdf.setFontSize(7)
    pdf.setTextColor(0, 0, 0)
    const labelWidth = pdf.getTextWidth(item.label)
    pdf.text(item.label, barX + barWidth / 2 - labelWidth / 2, y + height + 4)

    if (showValues && item.value > 0) {
      pdf.setFontSize(6)
      const valueText = formatValue(item.value)
      const valueWidth = pdf.getTextWidth(valueText)
      pdf.text(valueText, barX + barWidth / 2 - valueWidth / 2, barY - 1)
    }
  })

  pdf.setTextColor(0, 0, 0)
}

export const drawPieChart = (
  pdf: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  data: Array<{ label: string; value: number; color: string }>,
  options: { title?: string; showLegend?: boolean } = {}
) => {
  const { title, showLegend = true } = options

  if (title) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    const titleWidth = pdf.getTextWidth(title)
    pdf.text(title, centerX - titleWidth / 2, centerY - radius - 5)
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return

  let currentAngle = -Math.PI / 2

  data.forEach((item) => {
    if (item.value === 0) return

    const sliceAngle = (item.value / total) * 2 * Math.PI
    const endAngle = currentAngle + sliceAngle
    const color = hexToRgb(item.color)

    pdf.setFillColor(color.r, color.g, color.b)

    const startX = centerX + radius * Math.cos(currentAngle)
    const startY = centerY + radius * Math.sin(currentAngle)

    pdf.moveTo(centerX, centerY)
    pdf.lineTo(startX, startY)

    const steps = Math.max(10, Math.floor(sliceAngle * 20))
    for (let i = 1; i <= steps; i++) {
      const angle = currentAngle + (sliceAngle * i) / steps
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      pdf.lineTo(x, y)
    }

    pdf.lineTo(centerX, centerY)
    pdf.fill()

    if (sliceAngle > 0.2) {
      const percentage = ((item.value / total) * 100).toFixed(1)
      const labelAngle = currentAngle + sliceAngle / 2
      const labelX = centerX + (radius * 0.6) * Math.cos(labelAngle)
      const labelY = centerY + (radius * 0.6) * Math.sin(labelAngle)

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      const percentText = `${percentage}%`
      const textWidth = pdf.getTextWidth(percentText)
      pdf.text(percentText, labelX - textWidth / 2, labelY)
    }

    currentAngle = endAngle
  })

  if (showLegend) {
    let legendY = centerY + radius + 10
    data.forEach((item) => {
      if (item.value === 0) return

      const color = hexToRgb(item.color)
      pdf.setFillColor(color.r, color.g, color.b)
      pdf.rect(centerX - radius, legendY, 3, 3, 'F')

      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`${item.label}: €${formatValue(item.value)}`, centerX - radius + 5, legendY + 2.5)
      legendY += 5
    })
  }

  pdf.setTextColor(0, 0, 0)
}

export const drawLineChart = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Array<{ label: string; value: number }>,
  options: {
    title?: string
    color?: string
    showPoints?: boolean
    fillArea?: boolean
  } = {}
) => {
  const { title, color = '#2563eb', showPoints = true, fillArea = false } = options
  const lineColor = hexToRgb(color)

  if (title) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, x, y - 3)
  }

  pdf.setDrawColor(200, 200, 200)
  pdf.rect(x, y, width, height)

  if (data.length === 0) return

  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1
  const scale = height / range
  const stepX = width / (data.length - 1 || 1)

  const points = data.map((item, index) => ({
    x: x + index * stepX,
    y: y + height - ((item.value - min) * scale)
  }))

  if (fillArea) {
    pdf.setFillColor(lineColor.r, lineColor.g, lineColor.b, 0.2)
    pdf.moveTo(points[0].x, y + height)
    points.forEach(point => pdf.lineTo(point.x, point.y))
    pdf.lineTo(points[points.length - 1].x, y + height)
    pdf.lineTo(points[0].x, y + height)
    pdf.fill()
  }

  pdf.setDrawColor(lineColor.r, lineColor.g, lineColor.b)
  pdf.setLineWidth(0.5)
  points.forEach((point, index) => {
    if (index > 0) {
      pdf.line(points[index - 1].x, points[index - 1].y, point.x, point.y)
    }
  })

  if (showPoints) {
    pdf.setFillColor(lineColor.r, lineColor.g, lineColor.b)
    points.forEach(point => {
      pdf.circle(point.x, point.y, 1, 'F')
    })
  }

  pdf.setFontSize(7)
  pdf.setTextColor(0, 0, 0)
  data.forEach((item, index) => {
    const labelWidth = pdf.getTextWidth(item.label)
    pdf.text(item.label, points[index].x - labelWidth / 2, y + height + 4)
  })

  pdf.setLineWidth(0.2)
  pdf.setTextColor(0, 0, 0)
}

export const drawHorizontalBarChart = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Array<{ label: string; value: number; color?: string }>,
  options: { title?: string; showValues?: boolean } = {}
) => {
  const { title, showValues = true } = options

  if (title) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, x, y - 3)
  }

  if (data.length === 0) return

  const max = Math.max(...data.map(d => d.value))
  const barHeight = (height / data.length) - 2
  const scale = width / max

  data.forEach((item, index) => {
    const barWidth = item.value * scale
    const barY = y + (index * (height / data.length))
    const color = item.color ? hexToRgb(item.color) : { r: 37, g: 99, b: 235 }

    pdf.setFillColor(color.r, color.g, color.b)
    pdf.rect(x, barY, barWidth, barHeight, 'F')

    pdf.setFontSize(8)
    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'normal')
    const labelWidth = pdf.getTextWidth(item.label)
    pdf.text(item.label, x - 2 - labelWidth, barY + barHeight / 2 + 1)

    if (showValues) {
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatValue(item.value), x + barWidth + 2, barY + barHeight / 2 + 1)
    }
  })

  pdf.setTextColor(0, 0, 0)
}

export const drawProgressBar = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  percentage: number,
  options: {
    label?: string
    color?: string
    backgroundColor?: string
    showPercentage?: boolean
  } = {}
) => {
  const {
    label,
    color = '#22c55e',
    backgroundColor = '#e5e7eb',
    showPercentage = true
  } = options

  const bgColor = hexToRgb(backgroundColor)
  const fgColor = hexToRgb(color)

  pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b)
  pdf.rect(x, y, width, height, 'F')

  const fillWidth = (width * percentage) / 100
  pdf.setFillColor(fgColor.r, fgColor.g, fgColor.b)
  pdf.rect(x, y, fillWidth, height, 'F')

  if (label || showPercentage) {
    pdf.setFontSize(8)
    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'bold')
    const text = label ? `${label}: ${percentage.toFixed(1)}%` : `${percentage.toFixed(1)}%`
    const textWidth = pdf.getTextWidth(text)
    pdf.text(text, x + width / 2 - textWidth / 2, y + height / 2 + 1)
  }

  pdf.setTextColor(0, 0, 0)
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  hex = hex.replace('#', '')
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  }
}

const formatValue = (value: number): string => {
  if (value >= 1000000) {
    return `€${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `€${(value / 1000).toFixed(0)}K`
  }
  return `€${value.toFixed(0)}`
}
