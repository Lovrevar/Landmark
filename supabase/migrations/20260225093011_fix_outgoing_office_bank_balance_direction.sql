/*
  # Fix OUTGOING_OFFICE bank balance direction

  ## Problem
  OUTGOING_OFFICE invoice type was incorrectly placed in the "money going OUT" group
  in the bank balance trigger. 
  
  The correct logic is:
  - OUTGOING_* = we send an invoice to someone = we RECEIVE money = ADD to balance
  - INCOMING_* = we receive an invoice from someone = we PAY money = SUBTRACT from balance

  OUTGOING_OFFICE means our company issues an invoice to another party (like Telur/Cognilib),
  so money comes IN to our account.

  ## Changes
  1. Move OUTGOING_OFFICE from the "subtract" group to the "add" group
  2. Also moves OUTGOING_SUPPLIER and OUTGOING_RETAIL_* to "add" group for consistency
     (these mean WE issue the invoice = WE receive money)
  3. Recalculate all bank balances with corrected logic
*/

DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;
DROP FUNCTION IF EXISTS update_company_bank_account_balance();

CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_company_bank_account_id uuid;
  v_cesija_bank_account_id uuid;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_company_bank_account_id := NEW.company_bank_account_id;
    v_cesija_bank_account_id := NEW.cesija_bank_account_id;

    IF v_company_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE
            -- OUTGOING invoices: WE issue the invoice, so we RECEIVE money (+)
            WHEN ai.invoice_type IN (
              'OUTGOING_SALES',
              'OUTGOING_OFFICE',
              'OUTGOING_SUPPLIER',
              'OUTGOING_BANK',
              'OUTGOING_RETAIL_DEVELOPMENT',
              'OUTGOING_RETAIL_CONSTRUCTION'
            ) THEN ap.amount
            -- INCOMING invoices: we receive someone else's invoice, so we PAY (-)
            WHEN ai.invoice_type IN (
              'INCOMING_SUPPLIER',
              'INCOMING_OFFICE',
              'INCOMING_INVESTMENT',
              'INCOMING_BANK'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
        ), 0
      )
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

    IF v_cesija_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE
            WHEN ai.invoice_type IN (
              'OUTGOING_SALES',
              'OUTGOING_OFFICE',
              'OUTGOING_SUPPLIER',
              'OUTGOING_BANK',
              'OUTGOING_RETAIL_DEVELOPMENT',
              'OUTGOING_RETAIL_CONSTRUCTION'
            ) THEN ap.amount
            WHEN ai.invoice_type IN (
              'INCOMING_SUPPLIER',
              'INCOMING_OFFICE',
              'INCOMING_INVESTMENT',
              'INCOMING_BANK'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
        ), 0
      )
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

    IF v_company_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE
            WHEN ai.invoice_type IN (
              'OUTGOING_SALES',
              'OUTGOING_OFFICE',
              'OUTGOING_SUPPLIER',
              'OUTGOING_BANK',
              'OUTGOING_RETAIL_DEVELOPMENT',
              'OUTGOING_RETAIL_CONSTRUCTION'
            ) THEN ap.amount
            WHEN ai.invoice_type IN (
              'INCOMING_SUPPLIER',
              'INCOMING_OFFICE',
              'INCOMING_INVESTMENT',
              'INCOMING_BANK'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
        ), 0
      )
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

    IF v_cesija_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE
            WHEN ai.invoice_type IN (
              'OUTGOING_SALES',
              'OUTGOING_OFFICE',
              'OUTGOING_SUPPLIER',
              'OUTGOING_BANK',
              'OUTGOING_RETAIL_DEVELOPMENT',
              'OUTGOING_RETAIL_CONSTRUCTION'
            ) THEN ap.amount
            WHEN ai.invoice_type IN (
              'INCOMING_SUPPLIER',
              'INCOMING_OFFICE',
              'INCOMING_INVESTMENT',
              'INCOMING_BANK'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
        ), 0
      )
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

-- Recalculate ALL bank account balances with corrected logic
UPDATE company_bank_accounts
SET current_balance = initial_balance + COALESCE(
  (SELECT SUM(
    CASE
      WHEN ai.invoice_type IN (
        'OUTGOING_SALES',
        'OUTGOING_OFFICE',
        'OUTGOING_SUPPLIER',
        'OUTGOING_BANK',
        'OUTGOING_RETAIL_DEVELOPMENT',
        'OUTGOING_RETAIL_CONSTRUCTION'
      ) THEN ap.amount
      WHEN ai.invoice_type IN (
        'INCOMING_SUPPLIER',
        'INCOMING_OFFICE',
        'INCOMING_INVESTMENT',
        'INCOMING_BANK'
      ) THEN -ap.amount
      ELSE 0
    END
  )
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ap.company_bank_account_id = company_bank_accounts.id
  ), 0
)
- COALESCE(
  (SELECT SUM(ap.amount)
   FROM accounting_payments ap
   WHERE ap.cesija_bank_account_id = company_bank_accounts.id
     AND ap.is_cesija = true
  ), 0
),
updated_at = now();
