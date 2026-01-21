/*
  # Fix Bank Account Balance to Include Cesija Payments

  ## Summary
  Updates the bank account balance trigger to properly handle cesija payments.
  When a company pays via cesija (assignment), the amount should be deducted from
  their cesija_bank_account_id.

  ## Problem
  Current trigger only updates company_bank_account_id, but ignores cesija_bank_account_id.
  When Company A pays an invoice via cesija using their bank account, the balance doesn't decrease.

  ## Solution
  Update the trigger to also handle cesija_bank_account_id:
  - When payment has company_bank_account_id: update based on invoice type (income/expense)
  - When payment has cesija_bank_account_id: ALWAYS decrease balance (money going out)

  ## Changes
  1. Modified `update_company_bank_account_balance()` function to handle both scenarios
  2. Recalculate all bank balances to include cesija payments
*/

-- Drop and recreate function with cesija support
DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;
DROP FUNCTION IF EXISTS update_company_bank_account_balance();

CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_company_bank_account_id uuid;
  v_cesija_bank_account_id uuid;
  v_invoice_type text;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_company_bank_account_id := NEW.company_bank_account_id;
    v_cesija_bank_account_id := NEW.cesija_bank_account_id;
    
    -- Update regular company bank account (if payment is direct, not cesija)
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
      )
      -- Subtract cesija payments made FROM this account
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_company_bank_account_id
           AND ap.is_cesija = true
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;
    
    -- Update cesija bank account (if payment is via cesija)
    IF v_cesija_bank_account_id IS NOT NULL THEN
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
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
        ), 0
      )
      -- Subtract cesija payments made FROM this account
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
           AND ap.is_cesija = true
        ), 0
      ),
      updated_at = now()
      WHERE id = v_cesija_bank_account_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_company_bank_account_id := OLD.company_bank_account_id;
    v_cesija_bank_account_id := OLD.cesija_bank_account_id;
    
    -- Update regular company bank account
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
      )
      -- Subtract cesija payments made FROM this account
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_company_bank_account_id
           AND ap.is_cesija = true
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;
    
    -- Update cesija bank account
    IF v_cesija_bank_account_id IS NOT NULL THEN
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
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
        ), 0
      )
      -- Subtract cesija payments made FROM this account
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
           AND ap.is_cesija = true
        ), 0
      ),
      updated_at = now()
      WHERE id = v_cesija_bank_account_id;
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

-- Recalculate all bank balances to include cesija payments
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
)
-- Subtract cesija payments made FROM this account
- COALESCE(
  (SELECT SUM(ap.amount)
   FROM accounting_payments ap
   WHERE ap.cesija_bank_account_id = company_bank_accounts.id
     AND ap.is_cesija = true
  ), 0
),
updated_at = now();
