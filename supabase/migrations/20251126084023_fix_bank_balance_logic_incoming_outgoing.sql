/*
  # Fix Bank Account Balance Logic - Correct INCOMING/OUTGOING

  1. Problem
    - INCOMING invoices should DECREASE balance (we pay suppliers)
    - OUTGOING invoices should INCREASE balance (customers pay us)
    - Current logic is reversed

  2. Correct Logic
    - INCOMING_SUPPLIER: We receive invoice from supplier → We pay → SUBTRACT
    - INCOMING_INVESTMENT: Investor sends us money → We receive → ADD
    - INCOMING_OFFICE: We receive office invoice → We pay → SUBTRACT
    - OUTGOING_SUPPLIER: We pay supplier directly → SUBTRACT
    - OUTGOING_SALES: We invoice customer → Customer pays → ADD
    - OUTGOING_OFFICE: Office payment out → SUBTRACT

  3. Solution
    - INCOMING_INVESTMENT: ADD (we receive money)
    - INCOMING_SUPPLIER, INCOMING_OFFICE: SUBTRACT (we pay)
    - OUTGOING_SALES: ADD (customer pays us)
    - OUTGOING_SUPPLIER, OUTGOING_OFFICE: SUBTRACT (we pay out)
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;

-- Recreate the function with CORRECT logic
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
            -- Money coming IN to our account
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES') THEN ap.amount
            -- Money going OUT of our account
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE') THEN -ap.amount
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
            -- Money coming IN to our account
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES') THEN ap.amount
            -- Money going OUT of our account  
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE') THEN -ap.amount
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