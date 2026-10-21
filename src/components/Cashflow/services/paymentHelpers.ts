import type { TFunction } from 'i18next'
import { NO_VALUE } from '../../../utils/formatters'

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

/**
 * i18n key for a payment method, or `null` when there is nothing to translate — either the source
 * is a kompenzacija (no money moves, so the stored 'WIRE' is a placeholder, not a method) or the
 * value is one the vocabulary does not know and the caller shows raw.
 *
 * The labels used to be hardcoded Croatian here, which meant the English UI read "Virman". The
 * stored values are English and CHECK-constrained (`accounting_payments.payment_method`), so this
 * maps at render time only — nothing compares or writes back the translated text.
 */
export const getPaymentMethodLabelKey = (
  method: string | null | undefined,
  source?: string | null
): string | null => {
  if (source === 'kompenzacija') return null
  switch (method) {
    case 'WIRE': return 'payments.method_wire'
    case 'CASH': return 'payments.method_cash'
    case 'CHECK': return 'payments.method_check'
    case 'CARD': return 'payments.method_card'
    default: return null
  }
}

/**
 * Display label for a payment's method. Kompenzacija has no real method, so it shows "—"; an
 * unknown method shows as-is rather than vanishing.
 */
export const getPaymentMethodLabel = (
  method: string | null | undefined,
  source: string | null | undefined,
  t: TFunction
): string => {
  if (source === 'kompenzacija') return NO_VALUE
  const key = getPaymentMethodLabelKey(method, source)
  return key ? t(key) : (method || NO_VALUE)
}

/**
 * Badge colour for a payment's method. These are categories, not states, so the colours only tell
 * the methods apart; a kompenzacija has no method and stays neutral, like its "—" label.
 */
export type PaymentMethodVariant = 'blue' | 'green' | 'yellow' | 'purple' | 'gray'

export const getPaymentMethodVariant = (
  method: string | null | undefined,
  source?: string | null
): PaymentMethodVariant => {
  if (source === 'kompenzacija') return 'gray'
  switch (method) {
    case 'WIRE': return 'blue'
    case 'CASH': return 'green'
    case 'CHECK': return 'yellow'
    case 'CARD': return 'purple'
    default: return 'gray'
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
