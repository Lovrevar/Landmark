/*
  # Add INCOMING_BANK_EXPENSES to credit triggers and company statistics view

  ## Problem
  INCOMING_BANK_EXPENSES was missing from:
  1. sync_bank_credit_on_payment_change - payments on bank expense invoices did not trigger credit recalculation
  2. sync_bank_credit_on_invoice_change - bank expense invoices did not trigger credit recalculation
  3. company_statistics view - bank expense invoices were not counted in expense totals

  ## Changes
  1. Update sync_bank_credit_on_payment_change to include INCOMING_BANK_EXPENSES
  2. Update sync_bank_credit_on_invoice_change to include INCOMING_BANK_EXPENSES
  3. Recreate company_statistics view to include INCOMING_BANK_EXPENSES in expense group

  ## Notes
  - recalculate_bank_credit_fields uses INCOMING_BANK only for repaid_amount (principal repayment)
    INCOMING_BANK_EXPENSES are bank fees/charges, NOT loan repayments, so that function stays unchanged
  - handle_disbursed_credit_balance_update also stays unchanged for the same reason
*/

-- 1. Update sync_bank_credit_on_payment_change
CREATE OR REPLACE FUNCTION sync_bank_credit_on_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit_id      uuid;
  v_bank_credit_id uuid;
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(OLD.credit_id);
    END IF;
    IF OLD.cesija_credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(OLD.cesija_credit_id);
    END IF;
    IF OLD.invoice_id IS NOT NULL THEN
      SELECT ai.bank_credit_id INTO v_bank_credit_id
      FROM accounting_invoices ai
      WHERE ai.id = OLD.invoice_id
        AND ai.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES');
      IF v_bank_credit_id IS NOT NULL THEN
        PERFORM recalculate_bank_credit_fields(v_bank_credit_id);
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(NEW.credit_id);
    END IF;
    IF NEW.cesija_credit_id IS NOT NULL THEN
      PERFORM recalculate_bank_credit_fields(NEW.cesija_credit_id);
    END IF;
    IF NEW.invoice_id IS NOT NULL THEN
      SELECT ai.bank_credit_id INTO v_bank_credit_id
      FROM accounting_invoices ai
      WHERE ai.id = NEW.invoice_id
        AND ai.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES');
      IF v_bank_credit_id IS NOT NULL THEN
        PERFORM recalculate_bank_credit_fields(v_bank_credit_id);
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Update sync_bank_credit_on_invoice_change
CREATE OR REPLACE FUNCTION sync_bank_credit_on_invoice_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.bank_credit_id IS NOT NULL
      AND OLD.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES') THEN
      PERFORM recalculate_bank_credit_fields(OLD.bank_credit_id);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.bank_credit_id IS NOT NULL
      AND NEW.invoice_type IN ('OUTGOING_BANK', 'INCOMING_BANK', 'INCOMING_BANK_EXPENSES') THEN
      PERFORM recalculate_bank_credit_fields(NEW.bank_credit_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Recreate company_statistics view with INCOMING_BANK_EXPENSES in expense group
DROP VIEW IF EXISTS company_statistics;

CREATE VIEW company_statistics AS
SELECT
  c.id,
  c.name,
  c.oib,
  c.initial_balance,
  c.created_at,
  COALESCE(ba_stats.total_balance, 0) AS total_bank_balance,
  COALESCE(ba_stats.accounts_count, 0) AS bank_accounts_count,
  COALESCE(cr_stats.available, 0) AS total_credits_available,
  COALESCE(cr_stats.credits_count, 0) AS credits_count,

  COUNT(DISTINCT CASE
    WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE'])
    THEN inv.id ELSE NULL
  END) AS total_income_invoices,

  COALESCE(SUM(CASE
    WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE'])
    THEN inv.total_amount ELSE 0
  END), 0) AS total_income_amount,

  COALESCE(SUM(CASE
    WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE'])
    THEN inv.paid_amount ELSE 0
  END), 0) AS total_income_paid,

  COALESCE(SUM(CASE
    WHEN inv.invoice_type = ANY(ARRAY['INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE'])
    THEN inv.remaining_amount ELSE 0
  END), 0) AS total_income_unpaid,

  COUNT(DISTINCT CASE
    WHEN inv.invoice_type = ANY(ARRAY[
      'INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE',
      'INCOMING_BANK', 'INCOMING_BANK_EXPENSES', 'OUTGOING_BANK'
    ])
    THEN inv.id ELSE NULL
  END) AS total_expense_invoices,

  COALESCE(SUM(CASE
    WHEN inv.invoice_type = ANY(ARRAY[
      'INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE',
      'INCOMING_BANK', 'INCOMING_BANK_EXPENSES', 'OUTGOING_BANK'
    ])
    THEN inv.total_amount ELSE 0
  END), 0) AS total_expense_amount,

  (COALESCE(SUM(CASE
    WHEN inv.invoice_type = ANY(ARRAY[
      'INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE',
      'INCOMING_BANK', 'INCOMING_BANK_EXPENSES', 'OUTGOING_BANK'
    ])
    THEN inv.paid_amount ELSE 0
  END), 0) + COALESCE(cesija_stats.cesija_paid, 0)) AS total_expense_paid,

  COALESCE(SUM(CASE
    WHEN inv.invoice_type = ANY(ARRAY[
      'INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE',
      'INCOMING_BANK', 'INCOMING_BANK_EXPENSES', 'OUTGOING_BANK'
    ])
    THEN inv.remaining_amount ELSE 0
  END), 0) AS total_expense_unpaid

FROM accounting_companies c
LEFT JOIN LATERAL (
  SELECT
    SUM(current_balance) AS total_balance,
    COUNT(*) AS accounts_count
  FROM company_bank_accounts
  WHERE company_id = c.id
) ba_stats ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(amount - used_amount) AS available,
    COUNT(*) AS credits_count
  FROM bank_credits
  WHERE company_id = c.id
) cr_stats ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(ap.amount), 0) AS cesija_paid
  FROM accounting_payments ap
  WHERE ap.cesija_company_id = c.id
    AND ap.is_cesija = true
) cesija_stats ON true
LEFT JOIN accounting_invoices inv ON inv.company_id = c.id
GROUP BY
  c.id, c.name, c.oib, c.initial_balance, c.created_at,
  ba_stats.total_balance, ba_stats.accounts_count,
  cr_stats.available, cr_stats.credits_count,
  cesija_stats.cesija_paid;
