export type PaymentMethod = 'WIRE' | 'CASH' | 'CHECK' | 'CARD'

/**
 * Payment methods that make sense for a payment source. The DB only checks each column on its own
 * (payment_method IN WIRE/CASH/CHECK/CARD, payment_source_type IN bank_account/credit/
 * kompenzacija/gotovina), so without this a "Gotovina" payment could be recorded as a wire.
 *
 *   bank_account → WIRE, CARD, CHECK
 *   credit       → WIRE
 *   gotovina     → CASH
 *   kompenzacija → none (no money moves; the form hides the field and stores WIRE as a placeholder)
 *   cesija       → WIRE, whatever the source
 *
 * An unknown source allows every method, so an unexpected value never blocks a save.
 */
export const allowedPaymentMethods = (source: string | null | undefined, isCesija: boolean): PaymentMethod[] => {
  if (isCesija) return ['WIRE']
  switch (source) {
    case 'bank_account': return ['WIRE', 'CARD', 'CHECK']
    case 'credit': return ['WIRE']
    case 'gotovina': return ['CASH']
    case 'kompenzacija': return []
    default: return ['WIRE', 'CASH', 'CHECK', 'CARD']
  }
}

/**
 * The method to keep after the source (or cesija) changes: the current one if still allowed,
 * otherwise the first allowed one. Kompenzacija has none and gets the 'WIRE' placeholder.
 */
export const snapPaymentMethod = (
  method: string,
  source: string | null | undefined,
  isCesija: boolean
): PaymentMethod => {
  const allowed = allowedPaymentMethods(source, isCesija)
  if (allowed.length === 0) return 'WIRE'
  return (allowed as string[]).includes(method) ? (method as PaymentMethod) : allowed[0]
}

/** Display label for a payment's method. Kompenzacija has no real method, so it shows "—". */
export const getPaymentMethodLabel = (method: string, source?: string | null) => {
  if (source === 'kompenzacija') return '—'
  switch (method) {
    case 'WIRE': return 'Virman'
    case 'CASH': return 'Gotovina'
    case 'CHECK': return 'Ček'
    case 'CARD': return 'Kartica'
    default: return method
  }
}

export const getPaymentMethodColor = (method: string, source?: string | null) => {
  if (source === 'kompenzacija') return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  switch (method) {
    case 'WIRE': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
    case 'CASH': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    case 'CHECK': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
    case 'CARD': return 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  }
}

export const columnLabels = {
  payment_date: 'Datum plaćanja',
  invoice_number: 'Broj računa',
  my_company: 'Moja Firma',
  invoice_type: 'Tip računa',
  company_supplier: 'Firma/Dobavljač',
  amount: 'Iznos',
  payment_method: 'Način plaćanja',
  reference_number: 'Referenca',
  description: 'Opis'
}
