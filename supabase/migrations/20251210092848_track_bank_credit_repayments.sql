/*
  # Track Bank Credit Repayments via Invoice Payments

  1. Problem
    - Current system tracks `used_amount` when paying invoices via credit_id
    - But does not track `repaid_amount` when paying back the bank
    - Need to update `repaid_amount` and `outstanding_balance` when bank invoices are paid

  2. Solution
    - When an invoice with `bank_credit_id` is paid, increase `repaid_amount`
    - Update `outstanding_balance = amount - repaid_amount`

  3. Logic
    - Invoice with `bank_credit_id` + `invoice_category='BANK_CREDIT'` = bank repayment invoice
    - When payment is made on such invoice, update the credit's repaid_amount
    - outstanding_balance is automatically calculated as (amount - repaid_amount)
*/

-- Function to update repaid_amount when bank credit invoice is paid
CREATE OR REPLACE FUNCTION update_bank_credit_repaid_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_bank_credit_id uuid;

  v_payment_amount decimal(15,2);

BEGIN
  -- Get the invoice's bank_credit_id and payment amount
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT ai.bank_credit_id INTO v_invoice_bank_credit_id
    FROM accounting_invoices ai
    WHERE ai.id = NEW.invoice_id;


    v_payment_amount := NEW.amount;


    -- If this payment is for a bank credit invoice, update repaid_amount
    IF v_invoice_bank_credit_id IS NOT NULL THEN
      UPDATE bank_credits
      SET
        repaid_amount = COALESCE((
          SELECT SUM(ap.amount)
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ai.id = ap.invoice_id
          WHERE ai.bank_credit_id = v_invoice_bank_credit_id
        ), 0),
        outstanding_balance = amount - COALESCE((
          SELECT SUM(ap.amount)
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ai.id = ap.invoice_id
          WHERE ai.bank_credit_id = v_invoice_bank_credit_id
        ), 0)
      WHERE id = v_invoice_bank_credit_id;

    END IF;

  END IF;


  -- Handle payment deletion or update
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    SELECT ai.bank_credit_id INTO v_invoice_bank_credit_id
    FROM accounting_invoices ai
    WHERE ai.id = OLD.invoice_id;


    IF v_invoice_bank_credit_id IS NOT NULL THEN
      UPDATE bank_credits
      SET
        repaid_amount = COALESCE((
          SELECT SUM(ap.amount)
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ai.id = ap.invoice_id
          WHERE ai.bank_credit_id = v_invoice_bank_credit_id
        ), 0),
        outstanding_balance = amount - COALESCE((
          SELECT SUM(ap.amount)
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ai.id = ap.invoice_id
          WHERE ai.bank_credit_id = v_invoice_bank_credit_id
        ), 0)
      WHERE id = v_invoice_bank_credit_id;

    END IF;

  END IF;


  RETURN COALESCE(NEW, OLD);

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create trigger on accounting_payments
DROP TRIGGER IF EXISTS trg_update_bank_credit_repaid_amount ON accounting_payments;

CREATE TRIGGER trg_update_bank_credit_repaid_amount
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_repaid_amount();


-- Recalculate all repaid amounts based on existing payments
UPDATE bank_credits bc
SET
  repaid_amount = COALESCE((
    SELECT SUM(ap.amount)
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ai.id = ap.invoice_id
    WHERE ai.bank_credit_id = bc.id
  ), 0),
  outstanding_balance = amount - COALESCE((
    SELECT SUM(ap.amount)
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ai.id = ap.invoice_id
    WHERE ai.bank_credit_id = bc.id
  ), 0);

;