/*
  # Move Bank Account Selection from Invoice to Payment

  1. Problem
    - Bank account is currently selected when creating invoice
    - But we don't know which bank account to use until we make the payment
    - Need to move bank account selection to payment time

  2. Changes
    - Add company_bank_account_id to accounting_payments table
    - Make company_bank_account_id nullable on accounting_invoices
    - Update trigger to get bank account from payment instead of invoice
    - Migrate existing data: copy bank_account_id from invoice to all its payments

  3. Migration Strategy
    - Add new column to payments
    - Copy existing invoice bank accounts to all their payments
    - Make invoice column nullable
    - Update trigger function
*/

-- Add company_bank_account_id to accounting_payments
ALTER TABLE accounting_payments 
ADD COLUMN IF NOT EXISTS company_bank_account_id uuid REFERENCES company_bank_accounts(id);

-- Migrate existing data: copy bank account from invoice to all its payments
UPDATE accounting_payments ap
SET company_bank_account_id = ai.company_bank_account_id
FROM accounting_invoices ai
WHERE ap.invoice_id = ai.id
  AND ai.company_bank_account_id IS NOT NULL
  AND ap.company_bank_account_id IS NULL;

-- Make invoice bank account nullable (it was already nullable, but let's be explicit)
-- This column can stay for reference but won't be used in calculations

-- Drop existing trigger
DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;

-- Recreate the function to use payment's bank account instead of invoice's
CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_company_bank_account_id uuid;
  v_invoice_type text;
BEGIN
  -- Get the bank account ID from the PAYMENT (not invoice)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_company_bank_account_id := NEW.company_bank_account_id;
    
    IF v_company_bank_account_id IS NOT NULL THEN
      -- Get invoice type to determine if this is income or expense
      SELECT invoice_type 
      INTO v_invoice_type
      FROM accounting_invoices
      WHERE id = NEW.invoice_id;
      
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
        WHERE ap.company_bank_account_id = v_company_bank_account_id
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    v_company_bank_account_id := OLD.company_bank_account_id;
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER update_bank_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_company_bank_account_balance();

-- Recalculate all bank balances based on payments' bank accounts
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
  WHERE ap.company_bank_account_id = company_bank_accounts.id
  ), 0
),
updated_at = now();