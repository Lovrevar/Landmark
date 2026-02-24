/*
  # Add balance_reset_at to company_bank_accounts

  ## Summary
  Introduces a "reset point" concept for bank account balances.

  ## Problem
  The trigger always recalculates current_balance as:
    current_balance = initial_balance + SUM(ALL payments ever)

  This means when a user manually sets initial_balance to reflect the
  current real-world balance, all historical payments still get subtracted,
  producing incorrect results.

  ## Solution
  Add a `balance_reset_at` timestamp column. When a user updates
  initial_balance, balance_reset_at is set to now(). The trigger
  then only sums payments whose created_at is AFTER balance_reset_at,
  so historical payments are ignored.

  ## Changes
  1. New column `balance_reset_at` on `company_bank_accounts` (nullable timestamptz)
     - NULL means "use all payments" (backward-compatible for existing rows)
  2. Updated trigger function `update_company_bank_account_balance()` to
     filter accounting_payments by `created_at > balance_reset_at`
*/

-- 1. Add the column
ALTER TABLE company_bank_accounts
  ADD COLUMN IF NOT EXISTS balance_reset_at timestamptz;

-- 2. Drop and recreate the trigger function with balance_reset_at filtering
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
    v_cesija_bank_account_id  := NEW.cesija_bank_account_id;

    IF v_company_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK') THEN ap.amount
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE',
                                     'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
          AND (
            (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id) IS NULL
            OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id)
          )
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_company_bank_account_id
           AND ap.is_cesija = true
           AND (
             (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id) IS NULL
             OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id)
           )
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
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK') THEN ap.amount
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE',
                                     'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
          AND (
            (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id) IS NULL
            OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id)
          )
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
           AND ap.is_cesija = true
           AND (
             (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id) IS NULL
             OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id)
           )
        ), 0
      ),
      updated_at = now()
      WHERE id = v_cesija_bank_account_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_company_bank_account_id := OLD.company_bank_account_id;
    v_cesija_bank_account_id  := OLD.cesija_bank_account_id;

    IF v_company_bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET current_balance = initial_balance + COALESCE(
        (SELECT SUM(
          CASE
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK') THEN ap.amount
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE',
                                     'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
          AND (
            (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id) IS NULL
            OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id)
          )
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_company_bank_account_id
           AND ap.is_cesija = true
           AND (
             (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id) IS NULL
             OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_company_bank_account_id)
           )
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
            WHEN ai.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK') THEN ap.amount
            WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE',
                                     'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION') THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
          AND (
            (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id) IS NULL
            OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id)
          )
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
           AND ap.is_cesija = true
           AND (
             (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id) IS NULL
             OR ap.created_at > (SELECT balance_reset_at FROM company_bank_accounts WHERE id = v_cesija_bank_account_id)
           )
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
