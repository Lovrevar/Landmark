/*
  # Fix INCOMING_BANK to Update repaid_amount

  1. Problem
    - Current trigger only tracks OUTGOING_BANK for repaid_amount
    - But INCOMING_BANK should track repayments (when we pay the bank)
    - OUTGOING_BANK should track used_amount (when bank pays us)

  2. Solution
    - Update trigger to track INCOMING_BANK → repaid_amount
    - Keep OUTGOING_BANK → used_amount
    - Use base_amount for tracking (without VAT)
    - outstanding_balance = used_amount - repaid_amount

  3. Changes
    - Drop and recreate triggers to handle both INCOMING_BANK and OUTGOING_BANK
    - Recalculate all repaid_amount and used_amount values
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trg_update_bank_credit_repaid_amount ON accounting_payments;
DROP TRIGGER IF EXISTS trg_update_bank_credit_on_invoice_delete ON accounting_invoices;
DROP FUNCTION IF EXISTS update_bank_credit_repaid_amount();
DROP FUNCTION IF EXISTS update_bank_credit_on_invoice_delete();

-- Create function to update bank credit tracking when payments change
CREATE OR REPLACE FUNCTION update_bank_credit_repaid_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_bank_credit_id uuid;
  v_invoice_type text;
BEGIN
  -- Get invoice details
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

  -- Process INCOMING_BANK invoices (we pay bank = repayment)
  IF v_invoice_type = 'INCOMING_BANK' AND v_bank_credit_id IS NOT NULL THEN
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
      outstanding_balance = used_amount - COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'INCOMING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
          AND ai.total_amount > 0
      ), 0)
    WHERE id = v_bank_credit_id;
  END IF;

  -- Process OUTGOING_BANK invoices (bank pays us = drawing/using credit)
  IF v_invoice_type = 'OUTGOING_BANK' AND v_bank_credit_id IS NOT NULL THEN
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
      outstanding_balance = COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
          AND ai.total_amount > 0
      ), 0) - repaid_amount
    WHERE id = v_bank_credit_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on accounting_payments
CREATE TRIGGER trg_update_bank_credit_repaid_amount
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_repaid_amount();

-- Trigger when invoice itself is deleted
CREATE OR REPLACE FUNCTION update_bank_credit_on_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Process INCOMING_BANK invoices
  IF OLD.invoice_type = 'INCOMING_BANK' AND OLD.bank_credit_id IS NOT NULL THEN
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
      outstanding_balance = used_amount - COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'INCOMING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
          AND ai.total_amount > 0
      ), 0)
    WHERE id = OLD.bank_credit_id;
  END IF;

  -- Process OUTGOING_BANK invoices
  IF OLD.invoice_type = 'OUTGOING_BANK' AND OLD.bank_credit_id IS NOT NULL THEN
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
      outstanding_balance = COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
          AND ai.total_amount > 0
      ), 0) - repaid_amount
    WHERE id = OLD.bank_credit_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on accounting_invoices
CREATE TRIGGER trg_update_bank_credit_on_invoice_delete
  AFTER DELETE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_on_invoice_delete();

-- Recalculate all repaid_amount and used_amount values
UPDATE bank_credits
SET
  repaid_amount = COALESCE((
    SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'INCOMING_BANK'
      AND ai.bank_credit_id = bank_credits.id
      AND ai.total_amount > 0
  ), 0),
  used_amount = COALESCE((
    SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = bank_credits.id
      AND ai.total_amount > 0
  ), 0);

-- Recalculate outstanding_balance
UPDATE bank_credits
SET outstanding_balance = used_amount - repaid_amount;
