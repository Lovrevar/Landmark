export interface LineItem {
  name: string
  vlastita: number
  kreditna: number
}

export interface TICTotals {
  vlastita: number
  kreditna: number
}

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export const formatPercentage = (num: number): string => {
  return new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export const calculateRowPercentages = (value: number, total: number): number => {
  if (total === 0) return 0
  return (value / total) * 100
}

export const calculateTotals = (lineItems: LineItem[]): TICTotals => {
  return lineItems.reduce(
    (acc, item) => ({
      vlastita: acc.vlastita + item.vlastita,
      kreditna: acc.kreditna + item.kreditna,
    }),
    { vlastita: 0, kreditna: 0 }
  )
}
