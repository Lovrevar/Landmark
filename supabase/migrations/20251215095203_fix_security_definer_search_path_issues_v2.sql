/*
  # Fix Security Definer and Search Path Issues

  ## Problem
  Several functions were set to use `SECURITY DEFINER` with `SET search_path TO 'pg_catalog', 'public'`
  which causes issues with `auth.uid()` and RLS policies because the `auth` schema is not in the search path.

  ## Solution
  Update all affected functions to use proper search_path settings:
  - For functions using auth.uid(): Use 'public, pg_temp' and ensure auth.uid() is called correctly
  - For simple trigger functions: Use 'public, pg_temp'
  - Keep SECURITY DEFINER only where truly needed for bypassing RLS

  ## Functions Fixed
  1. calculate_invoice_amounts - Changed to public, pg_temp
  2. user_has_project_access(p_project_id) - Changed to public, pg_temp  
  3. update_updated_at_column - Changed to public, pg_temp
  4. update_accounting_payments_updated_at - Changed to public, pg_temp
  5. update_monthly_budgets_updated_at - Changed to public, pg_temp
  6. update_bank_credit_used_amount - Changed to public, pg_temp
  7. update_bank_credit_repaid_amount - Changed to public, pg_temp
  8. update_company_bank_account_balance - Changed to public, pg_temp
  9. update_contract_budget_realized - Changed to public, pg_temp
  10. reset_milestone_status_on_invoice_change - Changed to public, pg_temp
  11. get_subcontractor_payments(p_subcontractor_id, p_project_id) - Dropped and recreated
*/

-- 1. Fix calculate_invoice_amounts
CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.vat_amount := ROUND(NEW.base_amount * (NEW.vat_rate / 100), 2);
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  NEW.remaining_amount := NEW.total_amount - NEW.paid_amount;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 2. Fix user_has_project_access - this one uses auth.uid()
CREATE OR REPLACE FUNCTION public.user_has_project_access(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Directors have access to all projects
  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'Director'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Supervision users have access to assigned projects
  IF EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.project_managers pm ON pm.user_id = u.id
    WHERE u.id = auth.uid()
      AND u.role = 'Supervision'
      AND pm.project_id = p_project_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. Fix update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 4. Fix update_accounting_payments_updated_at
CREATE OR REPLACE FUNCTION update_accounting_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 5. Fix update_monthly_budgets_updated_at
CREATE OR REPLACE FUNCTION update_monthly_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 6. Fix update_bank_credit_used_amount
CREATE OR REPLACE FUNCTION update_bank_credit_used_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.payment_type = 'bank_credit_drawdown' AND NEW.bank_credit_id IS NOT NULL THEN
      UPDATE company_credits
      SET 
        drawn_amount = (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = NEW.bank_credit_id
            AND payment_type = 'bank_credit_drawdown'
        ),
        outstanding_balance = credit_amount - (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = NEW.bank_credit_id
            AND payment_type = 'bank_credit_drawdown'
        ) + (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = NEW.bank_credit_id
            AND payment_type = 'bank_credit_repayment'
        )
      WHERE id = NEW.bank_credit_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.payment_type = 'bank_credit_drawdown' AND OLD.bank_credit_id IS NOT NULL THEN
      UPDATE company_credits
      SET 
        drawn_amount = (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = OLD.bank_credit_id
            AND payment_type = 'bank_credit_drawdown'
        ),
        outstanding_balance = credit_amount - (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = OLD.bank_credit_id
            AND payment_type = 'bank_credit_drawdown'
        ) + (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = OLD.bank_credit_id
            AND payment_type = 'bank_credit_repayment'
        )
      WHERE id = OLD.bank_credit_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 7. Fix update_bank_credit_repaid_amount
CREATE OR REPLACE FUNCTION update_bank_credit_repaid_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.payment_type IN ('bank_credit_repayment', 'cesija') AND NEW.bank_credit_id IS NOT NULL THEN
      UPDATE company_credits
      SET 
        repaid_amount = (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = NEW.bank_credit_id
            AND payment_type IN ('bank_credit_repayment', 'cesija')
        ),
        outstanding_balance = credit_amount - (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = NEW.bank_credit_id
            AND payment_type = 'bank_credit_drawdown'
        ) + (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = NEW.bank_credit_id
            AND payment_type IN ('bank_credit_repayment', 'cesija')
        )
      WHERE id = NEW.bank_credit_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.payment_type IN ('bank_credit_repayment', 'cesija') AND OLD.bank_credit_id IS NOT NULL THEN
      UPDATE company_credits
      SET 
        repaid_amount = (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = OLD.bank_credit_id
            AND payment_type IN ('bank_credit_repayment', 'cesija')
        ),
        outstanding_balance = credit_amount - (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = OLD.bank_credit_id
            AND payment_type = 'bank_credit_drawdown'
        ) + (
          SELECT COALESCE(SUM(base_amount), 0)
          FROM accounting_payments
          WHERE bank_credit_id = OLD.bank_credit_id
            AND payment_type IN ('bank_credit_repayment', 'cesija')
        )
      WHERE id = OLD.bank_credit_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 8. Fix update_company_bank_account_balance
CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET balance = (
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN i.invoice_type IN ('incoming', 'incoming_sales', 'incoming_retail', 'bank_incoming') 
              THEN p.base_amount
              WHEN i.invoice_type IN ('outgoing', 'outgoing_subcontractor', 'outgoing_retail', 'outgoing_office', 'bank_outgoing')
              THEN -p.base_amount
              ELSE 0
            END
          ), 0)
        FROM accounting_payments p
        INNER JOIN accounting_invoices i ON p.invoice_id = i.id
        WHERE p.bank_account_id = NEW.bank_account_id
      )
      WHERE id = NEW.bank_account_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.bank_account_id IS NOT NULL THEN
      UPDATE company_bank_accounts
      SET balance = (
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN i.invoice_type IN ('incoming', 'incoming_sales', 'incoming_retail', 'bank_incoming') 
              THEN p.base_amount
              WHEN i.invoice_type IN ('outgoing', 'outgoing_subcontractor', 'outgoing_retail', 'outgoing_office', 'bank_outgoing')
              THEN -p.base_amount
              ELSE 0
            END
          ), 0)
        FROM accounting_payments p
        INNER JOIN accounting_invoices i ON p.invoice_id = i.id
        WHERE p.bank_account_id = OLD.bank_account_id
      )
      WHERE id = OLD.bank_account_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 9. Fix update_contract_budget_realized
CREATE OR REPLACE FUNCTION update_contract_budget_realized()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.contract_id IS NOT NULL THEN
      UPDATE contracts
      SET budget_realized = (
        SELECT COALESCE(SUM(ap.base_amount), 0)
        FROM accounting_payments ap
        INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.contract_id = NEW.contract_id
          AND ai.invoice_type = 'outgoing_subcontractor'
      )
      WHERE id = NEW.contract_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.contract_id IS NOT NULL THEN
      UPDATE contracts
      SET budget_realized = (
        SELECT COALESCE(SUM(ap.base_amount), 0)
        FROM accounting_payments ap
        INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.contract_id = OLD.contract_id
          AND ai.invoice_type = 'outgoing_subcontractor'
      )
      WHERE id = OLD.contract_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 10. Fix reset_milestone_status_on_invoice_change
CREATE OR REPLACE FUNCTION reset_milestone_status_on_invoice_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.milestone_id IS NOT NULL THEN
      UPDATE subcontractor_milestones
      SET status = 'pending'
      WHERE id = OLD.milestone_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.milestone_id IS DISTINCT FROM NEW.milestone_id THEN
      IF OLD.milestone_id IS NOT NULL THEN
        UPDATE subcontractor_milestones
        SET status = 'pending'
        WHERE id = OLD.milestone_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 11. Drop and recreate get_subcontractor_payments
DROP FUNCTION IF EXISTS get_subcontractor_payments(uuid, uuid);

CREATE OR REPLACE FUNCTION get_subcontractor_payments(p_subcontractor_id uuid, p_project_id uuid)
RETURNS TABLE (
  id uuid,
  payment_date date,
  amount numeric,
  description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wp.id,
    wp.payment_date,
    wp.amount,
    wp.description
  FROM wire_payments wp
  INNER JOIN subcontractor_milestones sm ON wp.milestone_id = sm.id
  INNER JOIN contracts c ON sm.contract_id = c.id
  WHERE c.subcontractor_id = p_subcontractor_id
    AND c.project_id = p_project_id
  ORDER BY wp.payment_date DESC;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
