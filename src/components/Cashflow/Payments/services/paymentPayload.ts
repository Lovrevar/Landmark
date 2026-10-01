import { PaymentFormData } from '../types'

/**
 * Maps payment form data to the `accounting_payments` row payload.
 *
 * The cesija (third-party debt assignment) and kompenzacija (mutual debt
 * offset) cases are mutually exclusive with a normal bank-account/credit
 * payment and must null out the fields they don't use:
 *  - cesija: the payer is another company, so the source is forced to
 *    'bank_account' and the bank-account/credit references are cleared while the
 *    cesija_* fields carry the third party.
 *  - kompenzacija: no money actually moves, so bank-account and credit
 *    references are null while payment_source_type stays 'kompenzacija'.
 *    It has no payment method either; payment_method is NOT NULL with a CHECK,
 *    so 'WIRE' is stored as a placeholder and the UI shows "—".
 *
 * Pure (no I/O) so it can be unit-tested in isolation; shared by
 * createPayment/updatePayment in paymentService.ts and by
 * invoiceService.handlePaymentSubmit (paying from the Invoices page).
 */
export function buildPaymentData(formData: PaymentFormData, createdBy: string | undefined) {
  const isKompenzacija = !formData.is_cesija && formData.payment_source_type === 'kompenzacija'

  // When cesija is active, payment_source_type carries the cesija funding source
  // ('bank_account' | 'credit').
  return {
    invoice_id: formData.invoice_id,
    payment_source_type: formData.payment_source_type,
    company_bank_account_id: formData.is_cesija || isKompenzacija ? null : (formData.payment_source_type === 'bank_account' ? (formData.company_bank_account_id || null) : null),
    credit_id: formData.is_cesija || isKompenzacija ? null : (formData.payment_source_type === 'credit' ? (formData.credit_id || null) : null),
    credit_allocation_id: formData.is_cesija || isKompenzacija ? null : (formData.payment_source_type === 'credit' ? (formData.credit_allocation_id || null) : null),
    is_cesija: formData.is_cesija,
    cesija_company_id: formData.is_cesija ? (formData.cesija_company_id || null) : null,
    cesija_bank_account_id: formData.is_cesija && formData.payment_source_type === 'bank_account' ? (formData.cesija_bank_account_id || null) : null,
    cesija_credit_id: formData.is_cesija && formData.payment_source_type === 'credit' ? (formData.cesija_credit_id || null) : null,
    cesija_credit_allocation_id: formData.is_cesija && formData.payment_source_type === 'credit' ? (formData.cesija_credit_allocation_id || null) : null,
    payment_date: formData.payment_date,
    amount: formData.amount,
    payment_method: isKompenzacija ? 'WIRE' : formData.payment_method,
    reference_number: formData.reference_number || null,
    description: formData.description,
    created_by: createdBy
  }
}
