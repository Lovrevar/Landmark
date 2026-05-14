/*
  # Fix Bank Credit Outstanding Balance Calculation

  ## Problem
  Migration 20251217103445 introduced a trigger that calculates outstanding_balance
  as the SUM of remaining_amount from unpaid INCOMING_BANK invoices. This is wrong:
  - Most credits have no INCOMING_BANK invoices, so outstanding becomes 0
  - It ignores the used_amount and repaid_amount fields entirely
  - Credits with no invoices show either 0 or their original amount incorrectly

  ## Correct Formula
  outstanding_balance = used_amount - repaid_amount

  Where:
  - used_amount  = total payments received on OUTGOING_BANK invoices (bank disbursing to us)
  - repaid_amount = total payments made on INCOMING_BANK invoices (us repaying the bank)
  - outstanding_balance = what we still owe = drawn down minus repaid

  ## Changes
  1. Drop the broken recalculate_bank_credit_outstanding trigger and function
  2. Update the existing update_bank_credit_repaid_amount trigger to also keep
     outstanding_balance = used_amount - repaid_amount at all times
  3. Recalculate all outstanding_balance values from current used_amount and repaid_amount
*/

-- Step 1: Drop the incorrect trigger and function from 20251217103445
DROP TRIGGER IF EXISTS recalculate_bank_credit_outstanding_trigger ON accounting_invoices;

DROP FUNCTION IF EXISTS recalculate_bank_credit_outstanding();


-- Step 2: Recreate the correct trigger function that maintains outstanding = used - repaid
CREATE OR REPLACE FUNCTION update_bank_credit_repaid_amount()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_bank_credit_id uuid;

  v_invoice_type text;

BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT ai.bank_credit_id, ai.invoice_type
    INTO v_bank_credit_id, v_invoice_type
    FROM accounting_invoices ai
    WHERE ai.id = OLD.invoice_id;

  ELSE
    SELECT ai.bank_credit_id, ai.invoice_type
    INTO v_bank_credit_id, v_invoice_type
    FROM accounting_invoices ai
    WHERE ai.id = NEW.invoice_id;

  END IF;


  IF v_bank_credit_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);

  END IF;


  IF v_invoice_type = 'INCOMING_BANK' THEN
    UPDATE bank_credits
    SET
      repaid_amount = COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'INCOMING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
          AND ai.total_amount > 0
      ), 0),
      outstanding_balance = GREATEST(
        COALESCE(used_amount, 0) - COALESCE((
          SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ai.invoice_type = 'INCOMING_BANK'
            AND ai.bank_credit_id = v_bank_credit_id
            AND ai.total_amount > 0
        ), 0),
        0
      )
    WHERE id = v_bank_credit_id;

  END IF;


  IF v_invoice_type = 'OUTGOING_BANK' THEN
    UPDATE bank_credits
    SET
      used_amount = COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
          AND ai.total_amount > 0
      ), 0),
      outstanding_balance = GREATEST(
        COALESCE((
          SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ai.invoice_type = 'OUTGOING_BANK'
            AND ai.bank_credit_id = v_bank_credit_id
            AND ai.total_amount > 0
        ), 0) - COALESCE(repaid_amount, 0),
        0
      )
    WHERE id = v_bank_credit_id;

  END IF;


  RETURN COALESCE(NEW, OLD);

END;

$$;


-- Step 3: Recreate the invoice-delete trigger with the same correct formula
CREATE OR REPLACE FUNCTION update_bank_credit_on_invoice_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.bank_credit_id IS NULL THEN
    RETURN OLD;

  END IF;


  IF OLD.invoice_type = 'INCOMING_BANK' THEN
    UPDATE bank_credits
    SET
      repaid_amount = COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'INCOMING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
          AND ai.total_amount > 0
      ), 0),
      outstanding_balance = GREATEST(
        COALESCE(used_amount, 0) - COALESCE((
          SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ai.invoice_type = 'INCOMING_BANK'
            AND ai.bank_credit_id = OLD.bank_credit_id
            AND ai.total_amount > 0
        ), 0),
        0
      )
    WHERE id = OLD.bank_credit_id;

  END IF;


  IF OLD.invoice_type = 'OUTGOING_BANK' THEN
    UPDATE bank_credits
    SET
      used_amount = COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
          AND ai.total_amount > 0
      ), 0),
      outstanding_balance = GREATEST(
        COALESCE((
          SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ai.invoice_type = 'OUTGOING_BANK'
            AND ai.bank_credit_id = OLD.bank_credit_id
            AND ai.total_amount > 0
        ), 0) - COALESCE(repaid_amount, 0),
        0
      )
    WHERE id = OLD.bank_credit_id;

  END IF;


  RETURN OLD;

END;

$$;


-- Step 4: Recalculate all current values from actual payment data
UPDATE bank_credits
SET
  used_amount = COALESCE((
    SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = bank_credits.id
      AND ai.total_amount > 0
  ), 0),
  repaid_amount = COALESCE((
    SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'INCOMING_BANK'
      AND ai.bank_credit_id = bank_credits.id
      AND ai.total_amount > 0
  ), 0);


UPDATE bank_credits
SET outstanding_balance = GREATEST(COALESCE(used_amount, 0) - COALESCE(repaid_amount, 0), 0);


COMMENT ON COLUMN bank_credits.outstanding_balance IS 'Automatically calculated: used_amount - repaid_amount. used_amount driven by OUTGOING_BANK invoice payments, repaid_amount by INCOMING_BANK invoice payments.';

;