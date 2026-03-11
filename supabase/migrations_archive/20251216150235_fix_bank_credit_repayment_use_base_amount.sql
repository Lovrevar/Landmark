/*
  # Fix Bank Credit Repayment to Use Base Amount

  1. Problem
    - Current triggers use ap.amount (total with VAT)
    - Should use base_amount (without VAT) for tracking repaid_amount
    - Example: 20000 base + 5000 VAT = 25000 total
      → repaid_amount should increase by 20000, not 25000

  2. Solution
    - Update triggers to calculate proportional base amount
    - Formula: ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0))
    - This handles partial payments correctly

  3. Changes
    - update_bank_credit_repaid_amount() function
    - update_bank_credit_on_invoice_delete() function
    - Recalculate existing repaid_amount values
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
    -- Recalculate repaid_amount using base_amount (without VAT)
    UPDATE bank_credits
    SET
      repaid_amount = COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
          AND ai.total_amount > 0
      ), 0),
      outstanding_balance = amount - COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = v_bank_credit_id
          AND ai.total_amount > 0
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
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
          AND ai.total_amount > 0
      ), 0),
      outstanding_balance = amount - COALESCE((
        SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK'
          AND ai.bank_credit_id = OLD.bank_credit_id
          AND ai.total_amount > 0
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

-- Reset repaid_amount to correct values using base_amount
UPDATE bank_credits
SET
  repaid_amount = COALESCE((
    SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = bank_credits.id
      AND ai.total_amount > 0
  ), 0),
  outstanding_balance = amount - COALESCE((
    SELECT SUM(ap.amount * (ai.base_amount / NULLIF(ai.total_amount, 0)))
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.invoice_type = 'OUTGOING_BANK'
      AND ai.bank_credit_id = bank_credits.id
      AND ai.total_amount > 0
  ), 0);
