import { allowedPaymentMethods } from '../../services/paymentHelpers'

/** The fields both payment forms (Invoices page and Payments page) validate. */
export interface PaymentValidationInput {
  amount: number | string
  payment_source_type: string
  is_cesija: boolean
  payment_method: string
  company_bank_account_id?: string | null
  credit_id?: string | null
  credit_allocation_id?: string | null
  cesija_company_id?: string | null
  cesija_bank_account_id?: string | null
  cesija_credit_id?: string | null
  cesija_credit_allocation_id?: string | null
}

export interface PaymentValidationContext {
  /**
   * The invoice's `remaining_amount` as stored. Omit when the invoice is not known — the
   * remaining-amount check is then skipped (the database trigger still recomputes the status).
   */
  remainingAmount?: number | null
  /**
   * When editing, the payment's amount before the edit. `remaining_amount` already has it
   * subtracted, so it is added back — otherwise editing a payment on a fully paid invoice fails.
   */
  originalAmount?: number | null
}

export type PaymentValidationErrorKey =
  | 'payments.form.error_amount_required'
  | 'payments.form.error_amount_exceeds_remaining'
  | 'payments.form.error_bank_account_required'
  | 'payments.form.error_credit_required'
  | 'payments.form.error_credit_allocation_required'
  | 'payments.form.error_cesija_company_required'
  | 'payments.form.error_method_mismatch'

const toCents = (value: number) => Math.round(value * 100)

/**
 * Validates a payment form. Returns the i18n key of the first problem, or null when it is valid.
 * Pure, so both hooks share it and it is unit-tested in paymentValidation.test.ts.
 */
export function validatePaymentForm(
  formData: PaymentValidationInput,
  { remainingAmount, originalAmount }: PaymentValidationContext = {}
): PaymentValidationErrorKey | null {
  const source = formData.payment_source_type
  const isCesija = formData.is_cesija

  const amount = Number(formData.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'payments.form.error_amount_required'
  }
  if (remainingAmount !== null && remainingAmount !== undefined) {
    const maxAmount = remainingAmount + (originalAmount ?? 0)
    // Compared in cents so float noise (0.1 + 0.2) cannot reject an exact full payment.
    if (toCents(amount) > toCents(maxAmount)) {
      return 'payments.form.error_amount_exceeds_remaining'
    }
  }

  if (!isCesija && source === 'bank_account' && !formData.company_bank_account_id) {
    return 'payments.form.error_bank_account_required'
  }
  if (!isCesija && source === 'credit' && !formData.credit_id) {
    return 'payments.form.error_credit_required'
  }
  if (!isCesija && source === 'credit' && !formData.credit_allocation_id) {
    return 'payments.form.error_credit_allocation_required'
  }

  if (isCesija && !formData.cesija_company_id) {
    return 'payments.form.error_cesija_company_required'
  }
  if (isCesija && source === 'bank_account' && !formData.cesija_bank_account_id) {
    return 'payments.form.error_bank_account_required'
  }
  if (isCesija && source === 'credit' && !formData.cesija_credit_id) {
    return 'payments.form.error_credit_required'
  }
  if (isCesija && source === 'credit' && !formData.cesija_credit_allocation_id) {
    return 'payments.form.error_credit_allocation_required'
  }

  // Backstop for rows saved before the forms restricted the method (e.g. a Gotovina payment
  // stored as WIRE) being edited. Kompenzacija has no method, so there is nothing to check.
  const allowed = allowedPaymentMethods(source, isCesija)
  if (allowed.length > 0 && !(allowed as string[]).includes(formData.payment_method)) {
    return 'payments.form.error_method_mismatch'
  }

  return null
}
