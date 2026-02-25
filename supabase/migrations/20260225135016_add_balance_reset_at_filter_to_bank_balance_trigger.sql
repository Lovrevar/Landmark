/*
  # Add balance_reset_at filter to bank balance trigger

  ## Summary
  Modifies the `update_company_bank_account_balance` trigger function so that when
  `balance_reset_at` is set on a bank account, only payments with a `payment_date`
  on or after that date (at 00:00) are included in the balance calculation.
  When `balance_reset_at` is NULL, all payments are included as before.

  ## Changes
  1. Adds `v_reset_at` and `v_cesija_reset_at` variables to hold the reset timestamps
     for each account being recalculated
  2. In every sub-query (invoice payments and cesija payments), adds the filter:
       AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
     using the appropriate variable for the account in scope
  3. Applies the same logic to both the INSERT/UPDATE and DELETE branches
  4. Recreates the trigger unchanged

  ## Notes
  - `initial_balance` is expected to be set to the balance at the reset point
    whenever `balance_reset_at` is updated, so no changes to initial_balance handling
    are required here
  - The comparison uses `ap.payment_date >= v_reset_at::date` which normalises the
    timestamp to midnight (00:00) for a date-only comparison
*/

DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;
DROP FUNCTION IF EXISTS update_company_bank_account_balance();

CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_company_bank_account_id uuid;
  v_cesija_bank_account_id uuid;
  v_reset_at timestamptz;
  v_cesija_reset_at timestamptz;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_company_bank_account_id := NEW.company_bank_account_id;
    v_cesija_bank_account_id := NEW.cesija_bank_account_id;

    IF v_company_bank_account_id IS NOT NULL THEN
      SELECT balance_reset_at INTO v_reset_at
      FROM company_bank_accounts
      WHERE id = v_company_bank_account_id;

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
              'INCOMING_BANK',
              'INCOMING_BANK_EXPENSES'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
          AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_company_bank_account_id
           AND ap.is_cesija = true
           AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;

    IF v_cesija_bank_account_id IS NOT NULL THEN
      SELECT balance_reset_at INTO v_cesija_reset_at
      FROM company_bank_accounts
      WHERE id = v_cesija_bank_account_id;

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
              'INCOMING_BANK',
              'INCOMING_BANK_EXPENSES'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
          AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
           AND ap.is_cesija = true
           AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
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
      SELECT balance_reset_at INTO v_reset_at
      FROM company_bank_accounts
      WHERE id = v_company_bank_account_id;

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
              'INCOMING_BANK',
              'INCOMING_BANK_EXPENSES'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_company_bank_account_id
          AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_company_bank_account_id
           AND ap.is_cesija = true
           AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
        ), 0
      ),
      updated_at = now()
      WHERE id = v_company_bank_account_id;
    END IF;

    IF v_cesija_bank_account_id IS NOT NULL THEN
      SELECT balance_reset_at INTO v_cesija_reset_at
      FROM company_bank_accounts
      WHERE id = v_cesija_bank_account_id;

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
              'INCOMING_BANK',
              'INCOMING_BANK_EXPENSES'
            ) THEN -ap.amount
            ELSE 0
          END
        )
        FROM accounting_payments ap
        JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ap.company_bank_account_id = v_cesija_bank_account_id
          AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
        ), 0
      )
      - COALESCE(
        (SELECT SUM(ap.amount)
         FROM accounting_payments ap
         WHERE ap.cesija_bank_account_id = v_cesija_bank_account_id
           AND ap.is_cesija = true
           AND (v_cesija_reset_at IS NULL OR ap.payment_date >= v_cesija_reset_at::date)
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
