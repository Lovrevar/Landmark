export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export const getStatusBadgeVariant = (status: string): 'green' | 'blue' | 'yellow' | 'gray' => {
  switch (status) {
    case 'Completed':
      return 'green'
    case 'In Progress':
      return 'blue'
    case 'Planning':
      return 'yellow'
    case 'On Hold':
      return 'gray'
    default:
      return 'gray'
  }
}
