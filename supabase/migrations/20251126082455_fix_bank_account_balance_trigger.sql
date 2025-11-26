/*
  # Fix Bank Account Balance Trigger

  1. Changes
    - Update trigger to look at invoice's company_bank_account_id, not payment's
    - The payment joins to invoice to find the bank account

  2. Notes
    - Payments don't have company_bank_account_id
    - Invoices have company_bank_account_id
    - Trigger needs to join through invoice to get bank account
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;

-- Recreate the function with correct logic
CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_company_bank_account_id uuid;
  v_invoice_type text;
BEGIN
  -- Get the bank account ID from the invoice
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    SELECT company_bank_account_id, invoice_type 
    INTO v_company_bank_account_id, v_invoice_type
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
    
    IF v_company_bank_account_id IS NOT NULL THEN
      -- Recalculate the bank account balance
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE 
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE') THEN ap.amount
            WHEN ai.invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.company_bank_account_id = v_company_bank_account_id
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    SELECT company_bank_account_id, invoice_type 
    INTO v_company_bank_account_id, v_invoice_type
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
    
    IF v_company_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE 
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE') THEN ap.amount
            WHEN ai.invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.company_bank_account_id = v_company_bank_account_id
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;
    
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER update_bank_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_company_bank_account_balance();