/*
  # Fix Function Search Path Security Issues

  ## Security Enhancement
  
  Functions with role-mutable search_path can be vulnerable to schema poisoning attacks.
  Setting an explicit search_path makes functions more secure and predictable.

  ## Changes
  
  Drop and recreate all affected functions with `SET search_path = public, pg_temp`.
  This ensures functions always use the public schema and temporary schema only.

  ## Affected Functions (30 total)
*/

-- Drop all functions first to avoid signature conflicts
DROP FUNCTION IF EXISTS update_wire_payments_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_work_logs_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_contracts_updated_at() CASCADE;
DROP FUNCTION IF EXISTS generate_contract_number() CASCADE;
DROP FUNCTION IF EXISTS update_subcontractor_milestones_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_milestone_status_on_payment() CASCADE;
DROP FUNCTION IF EXISTS user_has_project_access(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS check_subcontractor_budget_integrity() CASCADE;
DROP FUNCTION IF EXISTS calculate_invoice_amounts() CASCADE;
DROP FUNCTION IF EXISTS fix_subcontractor_budget_integrity() CASCADE;
DROP FUNCTION IF EXISTS validate_milestone_payment_status() CASCADE;
DROP FUNCTION IF EXISTS update_invoice_payment_status() CASCADE;
DROP FUNCTION IF EXISTS update_accounting_payments_updated_at() CASCADE;
DROP FUNCTION IF EXISTS generate_payment_schedule(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_overdue_notifications() CASCADE;
DROP FUNCTION IF EXISTS trigger_generate_payment_schedule() CASCADE;
DROP FUNCTION IF EXISTS trigger_update_payment_schedule() CASCADE;
DROP FUNCTION IF EXISTS trigger_mark_notification_completed() CASCADE;
DROP FUNCTION IF EXISTS recalculate_subcontractor_budget_realized() CASCADE;
DROP FUNCTION IF EXISTS get_subcontractor_payments(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_apartment_payments(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_bank_credit_payments(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_investor_payments(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_subcontractor_contract_count() CASCADE;
DROP FUNCTION IF EXISTS update_company_bank_account_balance() CASCADE;
DROP FUNCTION IF EXISTS reset_milestone_status_on_invoice_change() CASCADE;
DROP FUNCTION IF EXISTS reset_milestone_on_payment_delete() CASCADE;
DROP FUNCTION IF EXISTS update_contract_budget_on_invoice_delete() CASCADE;
DROP FUNCTION IF EXISTS update_contract_budget_realized() CASCADE;
DROP FUNCTION IF EXISTS set_invoice_category() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Now recreate all functions with secure search_path

CREATE FUNCTION update_wire_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_work_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_subcontractor_milestones_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_accounting_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION generate_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  year_suffix text;
  max_number integer;
  new_number text;
BEGIN
  year_suffix := TO_CHAR(NEW.start_date, 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM '\d+') AS integer)), 0)
  INTO max_number
  FROM contracts
  WHERE contract_number LIKE '%/' || year_suffix;
  
  new_number := LPAD((max_number + 1)::text, 3, '0') || '/' || year_suffix;
  NEW.contract_number := new_number;
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_milestone_status_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id uuid;
  v_milestone_id uuid;
  v_total_paid numeric;
  v_total_amount numeric;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_invoice_id := NEW.invoice_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  END IF;

  SELECT milestone_id, total_amount
  INTO v_milestone_id, v_total_amount
  FROM accounting_invoices
  WHERE id = v_invoice_id;

  IF v_milestone_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM accounting_payments
    WHERE invoice_id = v_invoice_id;

    IF v_total_paid >= v_total_amount THEN
      UPDATE subcontractor_milestones
      SET status = 'paid',
          paid_date = CURRENT_DATE
      WHERE id = v_milestone_id;
    ELSIF v_total_paid > 0 THEN
      UPDATE subcontractor_milestones
      SET status = 'completed',
          paid_date = NULL
      WHERE id = v_milestone_id;
    ELSE
      UPDATE subcontractor_milestones
      SET status = 'pending',
          paid_date = NULL
      WHERE id = v_milestone_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE FUNCTION recalculate_subcontractor_budget_realized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_base_amount numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  IF v_contract_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(SUM(ai.base_amount), 0)
  INTO v_total_base_amount
  FROM accounting_invoices ai
  WHERE ai.contract_id = v_contract_id
    AND ai.status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID');

  UPDATE contracts
  SET budget_realized = v_total_base_amount
  WHERE id = v_contract_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE FUNCTION update_contract_budget_realized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_paid numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  IF v_contract_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(SUM(base_amount), 0)
  INTO v_total_paid
  FROM accounting_invoices
  WHERE contract_id = v_contract_id;

  UPDATE contracts
  SET budget_realized = v_total_paid
  WHERE id = v_contract_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE FUNCTION update_contract_budget_on_invoice_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_base_amount numeric;
BEGIN
  v_contract_id := OLD.contract_id;

  IF v_contract_id IS NOT NULL THEN
    SELECT COALESCE(SUM(base_amount), 0)
    INTO v_total_base_amount
    FROM accounting_invoices
    WHERE contract_id = v_contract_id
      AND id != OLD.id;

    UPDATE contracts
    SET budget_realized = v_total_base_amount
    WHERE id = v_contract_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.vat_amount := NEW.base_amount * (NEW.vat_rate / 100);
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  NEW.remaining_amount := NEW.total_amount - COALESCE(NEW.paid_amount, 0);
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_invoice_total numeric;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_invoice_id := NEW.invoice_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM accounting_payments
  WHERE invoice_id = v_invoice_id;

  SELECT total_amount
  INTO v_invoice_total
  FROM accounting_invoices
  WHERE id = v_invoice_id;

  UPDATE accounting_invoices
  SET 
    paid_amount = v_total_paid,
    remaining_amount = v_invoice_total - v_total_paid,
    status = CASE
      WHEN v_total_paid = 0 THEN 'UNPAID'
      WHEN v_total_paid >= v_invoice_total THEN 'PAID'
      ELSE 'PARTIALLY_PAID'
    END
  WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE FUNCTION set_invoice_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    NEW.category := 'SUPPLIER';
  ELSIF NEW.customer_id IS NOT NULL THEN
    NEW.category := 'CUSTOMER';
  ELSIF NEW.office_supplier_id IS NOT NULL THEN
    NEW.category := 'OFFICE';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION reset_milestone_status_on_invoice_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.milestone_id IS NOT NULL THEN
    UPDATE subcontractor_milestones
    SET status = 'pending',
        paid_date = NULL
    WHERE id = OLD.milestone_id
      AND NOT EXISTS (
        SELECT 1 
        FROM accounting_invoices 
        WHERE milestone_id = OLD.milestone_id 
          AND status = 'PAID'
          AND id != OLD.id
      );
  END IF;

  RETURN OLD;
END;
$$;

CREATE FUNCTION reset_milestone_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_milestone_id uuid;
  v_invoice_total numeric;
  v_total_paid numeric;
BEGIN
  SELECT ai.milestone_id, ai.total_amount
  INTO v_milestone_id, v_invoice_total
  FROM accounting_invoices ai
  WHERE ai.id = OLD.invoice_id;

  IF v_milestone_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM accounting_payments
    WHERE invoice_id = OLD.invoice_id
      AND id != OLD.id;

    IF v_total_paid < v_invoice_total THEN
      UPDATE subcontractor_milestones
      SET status = CASE
        WHEN v_total_paid = 0 THEN 'pending'
        ELSE 'completed'
      END,
      paid_date = NULL
      WHERE id = v_milestone_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

CREATE FUNCTION validate_milestone_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_exists boolean;
BEGIN
  IF NEW.status = 'paid' THEN
    SELECT EXISTS (
      SELECT 1 
      FROM accounting_invoices 
      WHERE milestone_id = NEW.id 
        AND status = 'PAID'
    ) INTO v_invoice_exists;

    IF NOT v_invoice_exists THEN
      RAISE EXCEPTION 'Cannot set milestone to paid without a PAID invoice';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION user_has_project_access(user_uuid uuid, proj_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = user_uuid;
  
  IF user_role IN ('Director', 'Investment', 'Sales', 'Accounting') THEN
    RETURN true;
  ELSIF user_role = 'Supervision' THEN
    RETURN EXISTS (
      SELECT 1 FROM project_managers 
      WHERE user_id = user_uuid AND project_id = proj_id
    );
  END IF;
  
  RETURN false;
END;
$$;

CREATE FUNCTION check_subcontractor_budget_integrity()
RETURNS TABLE(
  contract_id uuid,
  contract_number text,
  budget_planned numeric,
  budget_realized numeric,
  calculated_realized numeric,
  difference numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as contract_id,
    c.contract_number,
    c.budget_planned,
    c.budget_realized,
    COALESCE(SUM(ai.base_amount), 0) as calculated_realized,
    c.budget_realized - COALESCE(SUM(ai.base_amount), 0) as difference
  FROM contracts c
  LEFT JOIN accounting_invoices ai ON ai.contract_id = c.id
  GROUP BY c.id, c.contract_number, c.budget_planned, c.budget_realized
  HAVING c.budget_realized != COALESCE(SUM(ai.base_amount), 0);
END;
$$;

CREATE FUNCTION fix_subcontractor_budget_integrity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE contracts c
  SET budget_realized = COALESCE(
    (SELECT SUM(base_amount) 
     FROM accounting_invoices 
     WHERE contract_id = c.id), 
    0
  );
END;
$$;

CREATE FUNCTION generate_payment_schedule(investment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  schedule_item jsonb;
  notification_date date;
BEGIN
  FOR schedule_item IN 
    SELECT jsonb_array_elements(payment_schedule) 
    FROM project_investments 
    WHERE id = investment_id
  LOOP
    notification_date := (schedule_item->>'date')::date;
    
    INSERT INTO payment_notifications (
      project_investment_id,
      due_date,
      amount,
      status
    ) VALUES (
      investment_id,
      notification_date,
      (schedule_item->>'amount')::numeric,
      'pending'
    );
  END LOOP;
END;
$$;

CREATE FUNCTION trigger_generate_payment_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_schedule IS NOT NULL AND jsonb_array_length(NEW.payment_schedule) > 0 THEN
    PERFORM generate_payment_schedule(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION trigger_update_payment_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_schedule IS DISTINCT FROM OLD.payment_schedule THEN
    DELETE FROM payment_notifications WHERE project_investment_id = NEW.id;
    
    IF NEW.payment_schedule IS NOT NULL AND jsonb_array_length(NEW.payment_schedule) > 0 THEN
      PERFORM generate_payment_schedule(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION trigger_mark_notification_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE payment_notifications
  SET status = 'completed'
  WHERE project_investment_id = NEW.project_investment_id
    AND due_date <= NEW.payment_date
    AND status = 'pending';
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION update_overdue_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE payment_notifications
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;

CREATE FUNCTION get_subcontractor_payments(subcontractor_uuid uuid)
RETURNS TABLE (
  id uuid,
  payment_date date,
  amount numeric,
  payment_method text,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.payment_date,
    ap.amount,
    ap.payment_method,
    ap.description,
    ap.created_at
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.supplier_id = subcontractor_uuid
  ORDER BY ap.payment_date DESC;
END;
$$;

CREATE FUNCTION get_apartment_payments(apartment_uuid uuid)
RETURNS TABLE (
  id uuid,
  payment_date date,
  amount numeric,
  payment_method text,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.payment_date,
    ap.amount,
    ap.payment_method,
    ap.description,
    ap.created_at
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.customer_id IN (
    SELECT customer_id FROM sales WHERE apartment_id = apartment_uuid
  )
  ORDER BY ap.payment_date DESC;
END;
$$;

CREATE FUNCTION get_bank_credit_payments(credit_uuid uuid)
RETURNS TABLE (
  id uuid,
  payment_date date,
  amount numeric,
  payment_method text,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    payment_date,
    amount,
    'Bank Transfer'::text as payment_method,
    notes as description,
    created_at
  FROM funding_payments
  WHERE bank_credit_id = credit_uuid
  ORDER BY payment_date DESC;
END;
$$;

CREATE FUNCTION get_investor_payments(investor_uuid uuid)
RETURNS TABLE (
  id uuid,
  payment_date date,
  amount numeric,
  payment_method text,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    payment_date,
    amount,
    'Bank Transfer'::text as payment_method,
    notes as description,
    created_at
  FROM funding_payments
  WHERE project_investment_id IN (
    SELECT id FROM project_investments WHERE investor_id = investor_uuid
  )
  ORDER BY payment_date DESC;
END;
$$;

CREATE FUNCTION update_subcontractor_contract_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE subcontractors
    SET contract_count = contract_count + 1
    WHERE id = NEW.subcontractor_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE subcontractors
    SET contract_count = GREATEST(0, contract_count - 1)
    WHERE id = OLD.subcontractor_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_id uuid;
  v_amount numeric;
  v_invoice_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_account_id := NEW.company_bank_account_id;
    v_amount := NEW.amount;
    
    SELECT invoice_type INTO v_invoice_type
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
    
    IF v_invoice_type = 'INCOMING_SUPPLIER' OR v_invoice_type = 'INCOMING_INVESTMENT' OR v_invoice_type = 'INCOMING_OFFICE' THEN
      UPDATE company_bank_accounts
      SET balance = balance + v_amount
      WHERE id = v_account_id;
    ELSIF v_invoice_type = 'OUTGOING_SUPPLIER' OR v_invoice_type = 'OUTGOING_SALES' OR v_invoice_type = 'OUTGOING_OFFICE' THEN
      UPDATE company_bank_accounts
      SET balance = balance - v_amount
      WHERE id = v_account_id;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_account_id := OLD.company_bank_account_id;
    v_amount := OLD.amount;
    
    SELECT invoice_type INTO v_invoice_type
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
    
    IF v_invoice_type = 'INCOMING_SUPPLIER' OR v_invoice_type = 'INCOMING_INVESTMENT' OR v_invoice_type = 'INCOMING_OFFICE' THEN
      UPDATE company_bank_accounts
      SET balance = balance - v_amount
      WHERE id = v_account_id;
    ELSIF v_invoice_type = 'OUTGOING_SUPPLIER' OR v_invoice_type = 'OUTGOING_SALES' OR v_invoice_type = 'OUTGOING_OFFICE' THEN
      UPDATE company_bank_accounts
      SET balance = balance + v_amount
      WHERE id = v_account_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate triggers that were dropped

CREATE TRIGGER update_contracts_updated_at_trigger
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_updated_at();

CREATE TRIGGER generate_contract_number_trigger
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION generate_contract_number();

CREATE TRIGGER update_work_logs_updated_at_trigger
  BEFORE UPDATE ON work_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_work_logs_updated_at();

CREATE TRIGGER update_subcontractor_milestones_updated_at_trigger
  BEFORE UPDATE ON subcontractor_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_milestones_updated_at();

CREATE TRIGGER validate_milestone_payment_status_trigger
  BEFORE UPDATE ON subcontractor_milestones
  FOR EACH ROW
  EXECUTE FUNCTION validate_milestone_payment_status();

CREATE TRIGGER calculate_invoice_amounts_trigger
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_amounts();

CREATE TRIGGER set_invoice_category_trigger
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_category();

CREATE TRIGGER recalculate_subcontractor_budget_realized_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_subcontractor_budget_realized();

CREATE TRIGGER update_contract_budget_on_invoice_delete_trigger
  BEFORE DELETE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_budget_on_invoice_delete();

CREATE TRIGGER reset_milestone_status_on_invoice_change_trigger
  BEFORE DELETE OR UPDATE OF status ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION reset_milestone_status_on_invoice_change();

CREATE TRIGGER update_accounting_payments_updated_at_trigger
  BEFORE UPDATE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_accounting_payments_updated_at();

CREATE TRIGGER update_invoice_payment_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

CREATE TRIGGER update_milestone_status_on_payment_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_status_on_payment();

CREATE TRIGGER reset_milestone_on_payment_delete_trigger
  BEFORE DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION reset_milestone_on_payment_delete();

CREATE TRIGGER update_company_bank_account_balance_trigger
  AFTER INSERT OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_company_bank_account_balance();

CREATE TRIGGER trigger_generate_payment_schedule_trigger
  AFTER INSERT ON project_investments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_payment_schedule();

CREATE TRIGGER trigger_update_payment_schedule_trigger
  AFTER UPDATE ON project_investments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_payment_schedule();

CREATE TRIGGER trigger_mark_notification_completed_trigger
  AFTER INSERT ON funding_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mark_notification_completed();

CREATE TRIGGER update_subcontractor_contract_count_trigger
  AFTER INSERT OR DELETE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_contract_count();
