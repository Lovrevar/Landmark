/*
  Bulk recalculation of bank_credits used_amount, repaid_amount, outstanding_balance

  Recalculates all three fields for every bank_credit record using the
  same logic as the unified trigger function recalculate_bank_credit_fields().

  used_amount:
    - Payments where credit_id = this credit          (direct credit allocation path)
    - Payments where cesija_credit_id = this credit   (cesija / assignment path)
    - Payments on OUTGOING_BANK invoices linked to this credit
    (union-deduplicated by payment id to avoid double-counting)

  repaid_amount:
    - Payments on INCOMING_BANK invoices linked to this credit

  outstanding_balance = used_amount - repaid_amount
    (negative is allowed but should not occur in practice)

  Safe to run multiple times (idempotent).
  Does NOT touch any other tables or columns.
*/

UPDATE bank_credits bc
SET
  used_amount = calc.used,
  repaid_amount = calc.repaid,
  outstanding_balance = calc.used - calc.repaid
FROM (
  SELECT
    bc2.id AS credit_id,

    -- used_amount: union of all three paths, deduplicated by payment id
    COALESCE((
      SELECT SUM(ap.amount)
      FROM accounting_payments ap
      WHERE ap.id IN (
        -- Path A: direct credit_id
        SELECT id FROM accounting_payments WHERE credit_id = bc2.id
        UNION
        -- Path B: cesija_credit_id
        SELECT id FROM accounting_payments WHERE cesija_credit_id = bc2.id
        UNION
        -- Path C: payments on OUTGOING_BANK invoices linked to this credit
        SELECT ap2.id
        FROM accounting_payments ap2
        JOIN accounting_invoices ai ON ap2.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = bc2.id
      )
    ), 0) AS used,

    -- repaid_amount: payments on INCOMING_BANK invoices linked to this credit
    COALESCE((
      SELECT SUM(ap.amount)
      FROM accounting_payments ap
      JOIN accounting_invoices ai ON ap.invoice_id = ai.id
      WHERE ai.invoice_type = 'INCOMING_BANK'
        AND ai.bank_credit_id = bc2.id
    ), 0) AS repaid

  FROM bank_credits bc2
) calc
WHERE bc.id = calc.credit_id;
