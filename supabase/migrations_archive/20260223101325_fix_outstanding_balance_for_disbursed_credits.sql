/*
  # Fix Outstanding Balance for Disbursed-to-Account Credits

  ## Problem
  When a credit has `disbursed_to_account = true`:
  1. The BEFORE INSERT trigger correctly sets `used_amount = amount`
  2. But it never sets `outstanding_balance`, leaving it at 0
  3. The unified AFTER trigger then calls `recalculate_bank_credit_fields` which
     computes `used_amount` from payment records (finds 0 payments for a new credit)
     and overwrites `outstanding_balance = 0 - 0 = 0`

  ## Fix
  1. Update BEFORE INSERT trigger to also set `outstanding_balance = amount`
  2. Update BEFORE UPDATE trigger to also set `outstanding_balance` correctly
     when flag is toggled on (= amount - repaid_amount) or off (recalc from payments)
  3. Update `recalculate_bank_credit_fields` to short-circuit for disbursed-to-account
     credits: set `used_amount = amount`, `outstanding_balance = amount - repaid_amount`
  4. One-time data repair for existing affected rows
*/

-- ============================================================
-- STEP 1: Fix BEFORE INSERT trigger to also set outstanding_balance
-- ============================================================

CREATE OR REPLACE FUNCTION handle_disbursed_credit_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = current_balance + NEW.amount
    WHERE id = NEW.disbursed_to_bank_account_id;

    NEW.used_amount         := NEW.amount;
    NEW.outstanding_balance := NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 2: Fix BEFORE UPDATE trigger to also set outstanding_balance
-- ============================================================

CREATE OR REPLACE FUNCTION handle_disbursed_credit_balance_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_repaid numeric;
BEGIN
  -- Toggled ON: full amount is now deployed
  IF OLD.disbursed_to_account = false AND NEW.disbursed_to_account = true AND NEW.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = current_balance + NEW.amount
    WHERE id = NEW.disbursed_to_bank_account_id;

    SELECT COALESCE(SUM(ap.amount), 0)
    INTO v_repaid
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'INCOMING_BANK'
      AND ai.bank_credit_id = NEW.id;

    NEW.used_amount         := NEW.amount;
    NEW.outstanding_balance := NEW.amount - v_repaid;
  END IF;

  -- Toggled OFF: revert bank balance, clear used_amount and outstanding_balance
  IF OLD.disbursed_to_account = true AND NEW.disbursed_to_account = false AND OLD.disbursed_to_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = current_balance - OLD.amount
    WHERE id = OLD.disbursed_to_bank_account_id;

    NEW.used_amount         := 0;
    NEW.outstanding_balance := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 3: Update recalculate_bank_credit_fields to respect
--         disbursed_to_account flag
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_bank_credit_fields(p_credit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used             numeric;
  v_repaid           numeric;
  v_amount           numeric;
  v_disbursed        boolean;
BEGIN
  IF p_credit_id IS NULL THEN
    RETURN;
  END IF;

  SELECT amount, disbursed_to_account
  INTO v_amount, v_disbursed
  FROM bank_credits
  WHERE id = p_credit_id;

  -- repaid_amount is always calculated the same way
  SELECT COALESCE(SUM(ap.amount), 0)
  INTO v_repaid
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.invoice_type = 'INCOMING_BANK'
    AND ai.bank_credit_id = p_credit_id;

  IF v_disbursed = true THEN
    -- For disbursed-to-account credits the full amount is always considered used;
    -- outstanding_balance reflects how much has not yet been repaid
    v_used := v_amount;
  ELSE
    -- Standard path: used_amount from payment records
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
  END IF;

  UPDATE bank_credits
  SET
    used_amount         = v_used,
    repaid_amount       = v_repaid,
    outstanding_balance = v_used - v_repaid
  WHERE id = p_credit_id;
END;
$$;

-- ============================================================
-- STEP 4: One-time data repair for existing affected rows
-- ============================================================

UPDATE bank_credits
SET
  used_amount         = amount,
  outstanding_balance = amount - repaid_amount
WHERE disbursed_to_account = true
  AND outstanding_balance = 0
  AND amount > 0;
