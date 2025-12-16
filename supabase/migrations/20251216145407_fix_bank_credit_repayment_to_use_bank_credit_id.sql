/*
  # Fix Bank Credit Repayment Tracking to Use bank_credit_id

  1. Problem
    - Current triggers look at `ai.bank_id` (which is accounting_companies.id where is_bank=true)
    - Should be looking at `ai.bank_credit_id` (which is bank_credits.id)
    - When OUTGOING_BANK invoices are paid, repaid_amount doesn't update correctly

  2. Solution
    - Update triggers to use bank_credit_id instead of bank_id
    - Recalculate repaid_amount based on bank_credit_id

  3. Logic
    - OUTGOING_BANK invoices represent repayments to the bank
    - When such invoice is paid, `repaid_amount` should increase by payment amount
    - Track via `bank_credit_id` column in accounting_invoices
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_update_bank_credit_repaid_amount ON accounting_payments;
DROP TRIGGER IF EXISTS trg_update_bank_credit_on_invoice_delete ON accounting_invoices;
DROP FUNCTION IF EXISTS update_bank_credit_repaid_amount();
DROP FUNCTION IF EXISTS update_bank_credit_on_invoice_delete();

-- Create function to update repaid_amount when OUTGOING_BANK payments change
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

  -- Only process OUTGOING_BANK invoices (repayments to bank)
  IF v_invoice_type = 'OUTGOING_BANK' AND v_bank_credit_id IS NOT NULL THEN
    -- Recalculate repaid_amount and outstanding_balance
    UPDATE bank_credits
    SET
      repaid_amount = COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
      ), 0),
      outstanding_balance = amount - COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
      ), 0)
    WHERE id = v_bank_credit_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on accounting_payments for OUTGOING_BANK tracking
CREATE TRIGGER trg_update_bank_credit_repaid_amount
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_repaid_amount();

-- Also need trigger when invoice itself is deleted (cascades to payments)
CREATE OR REPLACE FUNCTION update_bank_credit_on_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process OUTGOING_BANK invoices
  IF OLD.invoice_type = 'OUTGOING_BANK' AND OLD.bank_credit_id IS NOT NULL THEN
    UPDATE bank_credits
    SET
      repaid_amount = COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
      ), 0),
      outstanding_balance = amount - COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
      ), 0)
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

-- Reset repaid_amount to correct values based on bank_credit_id
UPDATE bank_credits
SET
  repaid_amount = COALESCE((
    SELECT SUM(ap.amount)
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = bank_credits.id
  ), 0),
  outstanding_balance = amount - COALESCE((
    SELECT SUM(ap.amount)
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = bank_credits.id
  ), 0);
