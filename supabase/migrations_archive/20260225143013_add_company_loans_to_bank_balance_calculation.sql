/*
  # Add company_loans to bank account balance calculation

  ## Summary
  The `update_company_bank_account_balance` function previously only considered
  `accounting_payments` (invoice payments and cesija payments) when recalculating
  a bank account's `current_balance`. This migration extends the calculation to also
  include `company_loans`, so that both outgoing loans (where the account is the lender)
  and incoming loans (where the account is the receiver) are factored in.

  ## Changes

  ### 1. Drop old loan triggers that directly mutated current_balance
  - Drop `trigger_update_bank_balances_on_loan_insert` on `company_loans`
  - Drop `trigger_update_bank_balances_on_loan_delete` on `company_loans`
  - Drop functions `update_bank_balances_on_loan_insert` and `update_bank_balances_on_loan_delete`
  - These are replaced by the unified recalculation approach below

  ### 2. Update `update_company_bank_account_balance` function
  For every bank account being recalculated, after the invoice payments sum and cesija
  deduction, two new COALESCE blocks are added:
  - Subtract loans where the account is `from_bank_account_id` (money went out)
    filtered by `loan_date >= v_reset_at::date` when reset is set
  - Add loans where the account is `to_bank_account_id` (money came in)
    filtered by `loan_date >= v_reset_at::date` when reset is set
  This applies to all four recalculation blocks (INSERT/UPDATE main account,
  INSERT/UPDATE cesija account, DELETE main account, DELETE cesija account)

  ### 3. New trigger on company_loans
  - New function `recalculate_balances_on_loan_change` calls
    `update_company_bank_account_balance`-style recalculation for both accounts
    involved in the loan whenever a loan is inserted or deleted
  - New trigger `trigger_recalculate_balances_on_loan_change` fires AFTER INSERT OR DELETE
    on `company_loans`

  ## Security
  - All new/updated functions use SECURITY DEFINER and SET search_path = public, pg_temp

  ## Notes
  - `balance_reset_at` filter uses `loan_date` for comparison (date column vs timestamptz)
  - Formula: current_balance = initial_balance + invoice_payments - cesija_payments - loans_given + loans_received
*/

-- Step 1: Drop old loan triggers and functions
DROP TRIGGER IF EXISTS trigger_update_bank_balances_on_loan_insert ON company_loans;
DROP TRIGGER IF EXISTS trigger_update_bank_balances_on_loan_delete ON company_loans;
DROP FUNCTION IF EXISTS update_bank_balances_on_loan_insert();
DROP FUNCTION IF EXISTS update_bank_balances_on_loan_delete();

-- Step 2: Replace update_company_bank_account_balance with loans-aware version
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
      SET current_balance = initial_balance
        + COALESCE(
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
          )
        - COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.from_bank_account_id = v_company_bank_account_id
               AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
            ), 0
          )
        + COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.to_bank_account_id = v_company_bank_account_id
               AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
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
      SET current_balance = initial_balance
        + COALESCE(
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
          )
        - COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.from_bank_account_id = v_cesija_bank_account_id
               AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
            ), 0
          )
        + COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.to_bank_account_id = v_cesija_bank_account_id
               AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
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
      SET current_balance = initial_balance
        + COALESCE(
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
          )
        - COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.from_bank_account_id = v_company_bank_account_id
               AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
            ), 0
          )
        + COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.to_bank_account_id = v_company_bank_account_id
               AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
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
      SET current_balance = initial_balance
        + COALESCE(
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
          )
        - COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.from_bank_account_id = v_cesija_bank_account_id
               AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
            ), 0
          )
        + COALESCE(
            (SELECT SUM(cl.amount)
             FROM company_loans cl
             WHERE cl.to_bank_account_id = v_cesija_bank_account_id
               AND (v_cesija_reset_at IS NULL OR cl.loan_date >= v_cesija_reset_at::date)
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

-- Step 3: New trigger function to recalculate balances when a loan changes
CREATE OR REPLACE FUNCTION recalculate_balances_on_loan_change()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id uuid;
  v_reset_at timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Recalculate from_bank_account (money went out)
    v_account_id := NEW.from_bank_account_id;
    SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
    UPDATE company_bank_accounts
    SET current_balance = initial_balance
      + COALESCE(
          (SELECT SUM(
            CASE
              WHEN ai.invoice_type IN (
                'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
                'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
              ) THEN ap.amount
              WHEN ai.invoice_type IN (
                'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
                'INCOMING_BANK','INCOMING_BANK_EXPENSES'
              ) THEN -ap.amount
              ELSE 0
            END
          )
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ap.company_bank_account_id = v_account_id
            AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(ap.amount)
           FROM accounting_payments ap
           WHERE ap.cesija_bank_account_id = v_account_id
             AND ap.is_cesija = true
             AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.from_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        )
      + COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.to_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        ),
      updated_at = now()
    WHERE id = v_account_id;

    -- Recalculate to_bank_account (money came in)
    v_account_id := NEW.to_bank_account_id;
    SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
    UPDATE company_bank_accounts
    SET current_balance = initial_balance
      + COALESCE(
          (SELECT SUM(
            CASE
              WHEN ai.invoice_type IN (
                'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
                'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
              ) THEN ap.amount
              WHEN ai.invoice_type IN (
                'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
                'INCOMING_BANK','INCOMING_BANK_EXPENSES'
              ) THEN -ap.amount
              ELSE 0
            END
          )
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ap.company_bank_account_id = v_account_id
            AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(ap.amount)
           FROM accounting_payments ap
           WHERE ap.cesija_bank_account_id = v_account_id
             AND ap.is_cesija = true
             AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.from_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        )
      + COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.to_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        ),
      updated_at = now()
    WHERE id = v_account_id;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Recalculate from_bank_account (money went out)
    v_account_id := OLD.from_bank_account_id;
    SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
    UPDATE company_bank_accounts
    SET current_balance = initial_balance
      + COALESCE(
          (SELECT SUM(
            CASE
              WHEN ai.invoice_type IN (
                'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
                'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
              ) THEN ap.amount
              WHEN ai.invoice_type IN (
                'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
                'INCOMING_BANK','INCOMING_BANK_EXPENSES'
              ) THEN -ap.amount
              ELSE 0
            END
          )
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ap.company_bank_account_id = v_account_id
            AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(ap.amount)
           FROM accounting_payments ap
           WHERE ap.cesija_bank_account_id = v_account_id
             AND ap.is_cesija = true
             AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.from_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        )
      + COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.to_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        ),
      updated_at = now()
    WHERE id = v_account_id;

    -- Recalculate to_bank_account (money came in)
    v_account_id := OLD.to_bank_account_id;
    SELECT balance_reset_at INTO v_reset_at FROM company_bank_accounts WHERE id = v_account_id;
    UPDATE company_bank_accounts
    SET current_balance = initial_balance
      + COALESCE(
          (SELECT SUM(
            CASE
              WHEN ai.invoice_type IN (
                'OUTGOING_SALES','OUTGOING_OFFICE','OUTGOING_SUPPLIER',
                'OUTGOING_BANK','OUTGOING_RETAIL_DEVELOPMENT','OUTGOING_RETAIL_CONSTRUCTION'
              ) THEN ap.amount
              WHEN ai.invoice_type IN (
                'INCOMING_SUPPLIER','INCOMING_OFFICE','INCOMING_INVESTMENT',
                'INCOMING_BANK','INCOMING_BANK_EXPENSES'
              ) THEN -ap.amount
              ELSE 0
            END
          )
          FROM accounting_payments ap
          JOIN accounting_invoices ai ON ap.invoice_id = ai.id
          WHERE ap.company_bank_account_id = v_account_id
            AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(ap.amount)
           FROM accounting_payments ap
           WHERE ap.cesija_bank_account_id = v_account_id
             AND ap.is_cesija = true
             AND (v_reset_at IS NULL OR ap.payment_date >= v_reset_at::date)
          ), 0
        )
      - COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.from_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        )
      + COALESCE(
          (SELECT SUM(cl.amount)
           FROM company_loans cl
           WHERE cl.to_bank_account_id = v_account_id
             AND (v_reset_at IS NULL OR cl.loan_date >= v_reset_at::date)
          ), 0
        ),
      updated_at = now()
    WHERE id = v_account_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE TRIGGER trigger_recalculate_balances_on_loan_change
  AFTER INSERT OR DELETE ON company_loans
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_balances_on_loan_change();
