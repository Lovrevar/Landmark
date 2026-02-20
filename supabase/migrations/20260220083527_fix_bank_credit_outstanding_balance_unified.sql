/*
  # Fix Bank Credit Outstanding Balance Calculation

  ## Problem
  Three separate triggers were writing to outstanding_balance with different
  and conflicting formulas, leading to incorrect values:

  1. trg_update_bank_credit_used_amount — only tracked direct credit_id payments,
     ignoring OUTGOING_BANK invoices entirely.
  2. trg_update_bank_credit_repaid_amount — correctly tracked INCOMING_BANK
     repayments but could race with #1 and produce wrong outstanding_balance.
  3. trg_update_bank_credit_on_invoice_delete — a third competing formula on
     invoice deletes.

  ## Fix
  Drop the old conflicting trigger functions and replace them with a single
  unified function that recalculates all three fields atomically from the
  correct sources, triggered from both accounting_payments and accounting_invoices.

  ## Definitions

  ### used_amount (how much of the credit line has been drawn/deployed)
  = SUM of payments where credit_id = this credit (credit allocation path)
  + SUM of payments where cesija_credit_id = this credit (cesija path)
  + SUM of payments on OUTGOING_BANK invoices linked to this credit

  Note: direct credit_id payments are often also linked via credit_allocation_id
  to the same credit, so we use DISTINCT payment ids to avoid double-counting.

  ### repaid_amount (how much has been paid back to the lender)
  = SUM of payments on INCOMING_BANK invoices linked to this credit

  ### outstanding_balance = used_amount - repaid_amount
  (can be negative if overpaid; should not happen in practice)

  ## Tables Modified
  - bank_credits: outstanding_balance, used_amount, repaid_amount recalculated
  
  ## Triggers Dropped
  - trg_update_bank_credit_used_amount (on accounting_payments)
  - trg_update_bank_credit_repaid_amount (on accounting_payments)
  - trg_update_bank_credit_on_invoice_delete (on accounting_invoices)
  - recalculate_bank_credit_outstanding_trigger (on accounting_invoices, if exists)

  ## New Triggers
  - trg_sync_bank_credit_on_payment (on accounting_payments INSERT/UPDATE/DELETE)
  - trg_sync_bank_credit_on_invoice (on accounting_invoices INSERT/UPDATE/DELETE)
*/

-- ============================================================
-- STEP 1: Drop all old conflicting triggers and functions
-- ============================================================

DROP TRIGGER IF EXISTS trg_update_bank_credit_used_amount ON accounting_payments;
DROP TRIGGER IF EXISTS trg_update_bank_credit_repaid_amount ON accounting_payments;
DROP TRIGGER IF EXISTS trg_update_bank_credit_on_invoice_delete ON accounting_invoices;
DROP TRIGGER IF EXISTS recalculate_bank_credit_outstanding_trigger ON accounting_invoices;

DROP FUNCTION IF EXISTS update_bank_credit_used_amount() CASCADE;
DROP FUNCTION IF EXISTS update_bank_credit_repaid_amount() CASCADE;
DROP FUNCTION IF EXISTS update_bank_credit_on_invoice_delete() CASCADE;
DROP FUNCTION IF EXISTS recalculate_bank_credit_outstanding() CASCADE;

-- ============================================================
-- STEP 2: Single unified recalculation function
-- ============================================================

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

  -- used_amount: money deployed FROM this credit line
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

  -- repaid_amount: money paid BACK to the lender
  --   Only payments against INCOMING_BANK invoices linked to this credit
  SELECT COALESCE(SUM(ap.amount), 0)
  INTO v_repaid
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.invoice_type = 'INCOMING_BANK'
    AND ai.bank_credit_id = p_credit_id;

  UPDATE bank_credits
  SET
    used_amount         = v_used,
    repaid_amount       = v_repaid,
    outstanding_balance = v_used - v_repaid
  WHERE id = p_credit_id;
END;
$$;

-- ============================================================
-- STEP 3: Trigger function for accounting_payments changes
-- ============================================================

CREATE OR REPLACE FUNCTION sync_bank_credit_on_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_id      uuid;
  v_bank_credit_id uuid;
BEGIN
  -- Collect every credit_id that may have been affected
  -- We recalculate for OLD values (on delete/update) and NEW values (on insert/update)

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    -- direct credit paths on old row
    IF OLD.credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(OLD.credit_id);
    END IF;
    IF OLD.cesija_credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(OLD.cesija_credit_id);
    END IF;
    -- OUTGOING_BANK / INCOMING_BANK invoice path on old invoice
    IF OLD.invoice_id IS NOT NULL THEN
      SELECT ai.bank_credit_id INTO v_bank_credit_id
      FROM accounting_invoices ai
      WHERE ai.id = OLD.invoice_id
        AND ai.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK');
      IF v_bank_credit_id IS NOT NULL THEN
        PERFORM recalculate_bank_credit_fields(v_bank_credit_id);
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- direct credit paths on new row
    IF NEW.credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(NEW.credit_id);
    END IF;
    IF NEW.cesija_credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(NEW.cesija_credit_id);
    END IF;
    -- OUTGOING_BANK / INCOMING_BANK invoice path on new invoice
    IF NEW.invoice_id IS NOT NULL THEN
      SELECT ai.bank_credit_id INTO v_bank_credit_id
      FROM accounting_invoices ai
      WHERE ai.id = NEW.invoice_id
        AND ai.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK');
      IF v_bank_credit_id IS NOT NULL THEN
        PERFORM recalculate_bank_credit_fields(v_bank_credit_id);
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- STEP 4: Trigger function for accounting_invoices changes
--         (handles bank_credit_id being assigned/changed on an invoice)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_bank_credit_on_invoice_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.bank_credit_id IS NOT NULL
       AND OLD.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK') THEN
      PERFORM recalculate_bank_credit_fields(OLD.bank_credit_id);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.bank_credit_id IS NOT NULL
       AND NEW.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK') THEN
      PERFORM recalculate_bank_credit_fields(NEW.bank_credit_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- STEP 5: Attach new triggers
-- ============================================================

CREATE TRIGGER trg_sync_bank_credit_on_payment
AFTER INSERT OR UPDATE OR DELETE
ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION sync_bank_credit_on_payment_change();

CREATE TRIGGER trg_sync_bank_credit_on_invoice
AFTER INSERT OR UPDATE OR DELETE
ON accounting_invoices
FOR EACH ROW
EXECUTE FUNCTION sync_bank_credit_on_invoice_change();
