/*
  # Fix repaid_amount to Use Base Amount (ex-VAT)

  ## Problem
  The unified trigger (20260220083527) calculates repaid_amount as SUM(ap.amount)
  for INCOMING_BANK invoices — this is the total payment amount including VAT.

  ## Fix
  repaid_amount should use the base amount (ex-VAT) from INCOMING_BANK invoices.

  Formula: SUM(ap.amount * (ai.base_amount / ai.total_amount))
  When an invoice is fully paid: ap.amount = total_amount → result = base_amount.
  For partial payments: proportional base amount is used.

  outstanding_balance = used_amount - repaid_amount
  (used_amount formula is unchanged)
*/

-- Replace the unified recalculation function with base_amount for repaid
CREATE OR REPLACE FUNCTION recalculate_bank_credit_fields(p_credit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used   numeric;
  v_repaid numeric;
BEGIN
  IF p_credit_id IS NULL THEN
    RETURN;
  END IF;

  -- used_amount: money deployed FROM this credit line (unchanged)
  --   Path A: direct credit_id on payment (credit allocation / direct supplier payment)
  --   Path B: cesija_credit_id on payment (cesija / assignment path)
  --   Path C: payments against OUTGOING_BANK invoices linked to this credit
  --   UNION to deduplicate payment ids that may appear in multiple paths
  SELECT COALESCE(SUM(ap.amount), 0)
  INTO v_used
  FROM accounting_payments ap
  WHERE ap.id IN (
    SELECT id FROM accounting_payments WHERE credit_id = p_credit_id
    UNION
    SELECT id FROM accounting_payments WHERE cesija_credit_id = p_credit_id
    UNION
    SELECT ap2.id
    FROM accounting_payments ap2
    JOIN accounting_invoices ai ON ap2.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = p_credit_id
  );

  -- repaid_amount: base amount (ex-VAT) paid back to the lender
  -- Using ap.amount * (base_amount / total_amount) to extract the ex-VAT portion.
  -- When fully paid: ap.amount = total_amount → result equals base_amount exactly.
  SELECT COALESCE(SUM(
    ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0))
  ), 0)
  INTO v_repaid
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.invoice_type = 'INCOMING_BANK'
    AND ai.bank_credit_id = p_credit_id
    AND ai.total_amount > 0;

  UPDATE bank_credits
  SET
    used_amount         = v_used,
    repaid_amount       = v_repaid,
    outstanding_balance = v_used - v_repaid
  WHERE id = p_credit_id;
END;
$$;

-- Recalculate all existing bank_credits with the corrected formula
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM bank_credits LOOP
    PERFORM recalculate_bank_credit_fields(r.id);
  END LOOP;
END;
$$;
