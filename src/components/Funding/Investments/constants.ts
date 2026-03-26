export const INVOICE_STATUS_CONFIG: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'gray' }> = {
  PAID:           { label: 'Plaćeno',    variant: 'green'  },
  PARTIALLY_PAID: { label: 'Djelomično', variant: 'yellow' },
  UNPAID:         { label: 'Neplaćeno',  variant: 'red'    },
}
