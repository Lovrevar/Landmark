import { formatEuroRounded } from '../../utils/formatters'

/** Retail's whole-euro renderer. Delegates so the € leads, as it does everywhere else. */
export const formatCurrency = formatEuroRounded

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
