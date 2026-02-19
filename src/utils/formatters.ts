export const formatEuropean = (value: number): string => {
  return value.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const formatEuro = (value: number): string => {
  return `€${formatEuropean(value)}`
}
