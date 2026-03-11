/*
  # Fix Bank Credit Repaid Amount Tracking

  1. Problem
    - When OUTGOING_BANK invoices (credit repayments to bank) are deleted, `repaid_amount` in `bank_credits` is not updated
    - Currently `repaid_amount` shows 10,000 but the invoice was deleted
    - No trigger exists to track repayment changes

  2. Solution
    - Add trigger to recalculate `repaid_amount` when OUTGOING_BANK invoices are paid/deleted
    - Recalculate `outstanding_balance` = amount - repaid_amount
    - Reset current incorrect data

  3. Logic
    - OUTGOING_BANK invoices represent repayments to the bank
    - When such invoice is paid, `repaid_amount` should increase
    - When such invoice/payment is deleted, `repaid_amount` should decrease
    - `outstanding_balance` = credit amount - total repaid to bank
*/

-- First, reset incorrect repaid_amount data
UPDATE bank_credits
SET repaid_amount = COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.invoice_type = 'OUTGOING_BANK' 
    AND ai.bank_id = bank_credits.id
), 0),
outstanding_balance = amount - COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.invoice_type = 'OUTGOING_BANK' 
    AND ai.bank_id = bank_credits.id
), 0);

-- Create function to update repaid_amount when OUTGOING_BANK payments change
CREATE OR REPLACE FUNCTION update_bank_credit_repaid_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_bank_id uuid;
  v_invoice_type text;
BEGIN
  -- Get invoice details
  IF TG_OP = 'DELETE' THEN
    SELECT ai.bank_id, ai.invoice_type 
    INTO v_bank_id, v_invoice_type
    FROM accounting_invoices ai
    WHERE ai.id = OLD.invoice_id;
  ELSE
    SELECT ai.bank_id, ai.invoice_type 
    INTO v_bank_id, v_invoice_type
    FROM accounting_invoices ai
    WHERE ai.id = NEW.invoice_id;
  END IF;

  -- Only process OUTGOING_BANK invoices (repayments to bank)
  IF v_invoice_type = 'OUTGOING_BANK' AND v_bank_id IS NOT NULL THEN
    -- Recalculate repaid_amount and outstanding_balance
    UPDATE bank_credits
    SET 
      repaid_amount = COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK' 
          AND ai.bank_id = v_bank_id
      ), 0),
      outstanding_balance = amount - COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK' 
          AND ai.bank_id = v_bank_id
      ), 0)
    WHERE id = v_bank_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on accounting_payments for OUTGOING_BANK tracking
DROP TRIGGER IF EXISTS trg_update_bank_credit_repaid_amount ON accounting_payments;
CREATE TRIGGER trg_update_bank_credit_repaid_amount
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_repaid_amount();

-- Also need trigger when invoice itself is deleted (cascades to payments)
CREATE OR REPLACE FUNCTION update_bank_credit_on_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process OUTGOING_BANK invoices
  IF OLD.invoice_type = 'OUTGOING_BANK' AND OLD.bank_id IS NOT NULL THEN
    UPDATE bank_credits
    SET 
      repaid_amount = COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK' 
          AND ai.bank_id = OLD.bank_id
      ), 0),
      outstanding_balance = amount - COALESCE((
        SELECT SUM(ap.amount)
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.invoice_type = 'OUTGOING_BANK' 
          AND ai.bank_id = OLD.bank_id
      ), 0)
    WHERE id = OLD.bank_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on accounting_invoices
DROP TRIGGER IF EXISTS trg_update_bank_credit_on_invoice_delete ON accounting_invoices;
CREATE TRIGGER trg_update_bank_credit_on_invoice_delete
  AFTER DELETE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_on_invoice_delete();
