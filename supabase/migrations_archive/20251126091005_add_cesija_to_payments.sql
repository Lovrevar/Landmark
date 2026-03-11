/*
  # Add Cesija (Assignment) to Payments

  1. Problem
    - Sometimes one company (e.g., Nova) needs to pay invoices for another company (e.g., Landmark)
    - The invoice remains between original company and supplier
    - But payment comes from a different company's bank account
    - Need to track this for proper accounting

  2. Changes
    - Add is_cesija flag to accounting_payments
    - Add cesija_company_id to track which company is actually paying
    - Add cesija_bank_account_id to track which bank account is used
    - Update trigger to deduct from cesija company's bank account when applicable
    - Add notes/description to indicate cesija

  3. Usage Flow
    - User creates invoice for Company A (Landmark)
    - User creates payment and checks "Ugovor o cesiji"
    - User selects Company B (Nova) as paying company
    - User selects bank account from Company B
    - System deducts from Company B's bank account
    - Invoice still shows as Company A's invoice to supplier
*/

-- Add cesija fields to accounting_payments
ALTER TABLE accounting_payments 
ADD COLUMN IF NOT EXISTS is_cesija boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cesija_company_id uuid REFERENCES accounting_companies(id),
ADD COLUMN IF NOT EXISTS cesija_bank_account_id uuid REFERENCES company_bank_accounts(id);

-- Add comment
COMMENT ON COLUMN accounting_payments.is_cesija IS 'Indicates if this is a cesija payment (one company paying for another)';
COMMENT ON COLUMN accounting_payments.cesija_company_id IS 'The company that is actually making the payment (if cesija)';
COMMENT ON COLUMN accounting_payments.cesija_bank_account_id IS 'The bank account used for cesija payment';

-- Update trigger to handle cesija payments
DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;

CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_bank_account_id uuid;
  v_invoice_type text;
BEGIN
  -- Get the bank account ID - use cesija bank account if it's a cesija payment
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.is_cesija AND NEW.cesija_bank_account_id IS NOT NULL THEN
      v_bank_account_id := NEW.cesija_bank_account_id;
    ELSE
      v_bank_account_id := NEW.company_bank_account_id;
    END IF;
    
    IF v_bank_account_id IS NOT NULL THEN
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
        WHERE (
          -- Regular payments using this bank account
          (ap.is_cesija = false AND ap.company_bank_account_id = v_bank_account_id)
          OR
          -- Cesija payments using this bank account
          (ap.is_cesija = true AND ap.cesija_bank_account_id = v_bank_account_id)
        )
        ), 0
      ),
      updated_at = now()
      WHERE id = v_bank_account_id;
    END IF;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_cesija AND OLD.cesija_bank_account_id IS NOT NULL THEN
      v_bank_account_id := OLD.cesija_bank_account_id;
    ELSE
      v_bank_account_id := OLD.company_bank_account_id;
    END IF;
    
    IF v_bank_account_id IS NOT NULL THEN
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
        WHERE (
          (ap.is_cesija = false AND ap.company_bank_account_id = v_bank_account_id)
          OR
          (ap.is_cesija = true AND ap.cesija_bank_account_id = v_bank_account_id)
        )
        ), 0
      ),
      updated_at = now()
      WHERE id = v_bank_account_id;
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

-- Recalculate all bank balances to account for cesija payments
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
  WHERE (
    (ap.is_cesija = false AND ap.company_bank_account_id = company_bank_accounts.id)
    OR
    (ap.is_cesija = true AND ap.cesija_bank_account_id = company_bank_accounts.id)
  )
  ), 0
),
updated_at = now();