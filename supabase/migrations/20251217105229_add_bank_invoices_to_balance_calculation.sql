/*
  # Add Bank Invoice Types to Balance Calculation
  
  1. Problem
    - Bank account balance trigger doesn't include INCOMING_BANK and OUTGOING_BANK invoice types
    - When bank invoices are paid, bank balance doesn't update
  
  2. Changes
    - Update trigger function to include INCOMING_BANK and OUTGOING_BANK
    - INCOMING_BANK = money going OUT (we're paying the bank)
    - OUTGOING_BANK = money coming IN (bank is paying us - rare but possible)
  
  3. Behavior
    - INCOMING_BANK: decreases bank balance (we pay bank)
    - OUTGOING_BANK: increases bank balance (bank pays us)
*/

-- Drop and recreate function with bank invoice types included
DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;
DROP FUNCTION IF EXISTS update_company_bank_account_balance();

CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_company_bank_account_id uuid;
  v_invoice_type text;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_company_bank_account_id := NEW.company_bank_account_id;
    
    IF v_company_bank_account_id IS NOT NULL THEN
      SELECT invoice_type 
      INTO v_invoice_type
      FROM accounting_invoices
      WHERE id = NEW.invoice_id;
      
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE 
            -- Money coming IN to our account
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK') THEN ap.amount
            -- Money going OUT of our account
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE', 'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_company_bank_account_id := OLD.company_bank_account_id;
    
    IF v_company_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE 
            -- Money coming IN to our account
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK') THEN ap.amount
            -- Money going OUT of our account  
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE', 'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;
    
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE TRIGGER update_bank_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_company_bank_account_balance();

-- Recalculate all bank balances to include bank invoices
UPDATE company_bank_accounts
SET current_balance = initial_balance + COALESCE(
  (SELECT SUM(
    CASE 
      -- Money coming IN to our account
      WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK') THEN ap.amount
      -- Money going OUT of our account
      WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE', 'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION') THEN -ap.amount
      ELSE 0
    END
  )
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ap.company_bank_account_id = company_bank_accounts.id
  ), 0
),
updated_at = now();