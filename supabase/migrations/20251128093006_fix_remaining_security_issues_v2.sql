/*
  # Fix Remaining Security Issues

  1. Add Missing Indexes for Foreign Keys (11 new indexes)
    - accounting_invoices: apartment_id, bank_credit_id, bank_id, investment_id, investor_id, project_id
    - accounting_payments: created_by
    - funding_payments: bank_id, investor_id
    - subcontractors: financed_by_bank_id, financed_by_investor_id

  2. Remove Unused Indexes (31 indexes)
    - These indexes consume storage and slow down INSERT/UPDATE operations
    - They are not being used by queries

  3. Fix Function Search Path Issues (2 functions)
    - user_has_project_access
    - get_subcontractor_payments

  4. Keep Multiple Permissive Policies
    - These are intentional for role-based access control
    - Different roles need different access patterns
*/

-- ===================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ===================================

-- accounting_invoices foreign key indexes
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_apartment_id 
  ON accounting_invoices(apartment_id) 
  WHERE apartment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_bank_credit_id 
  ON accounting_invoices(bank_credit_id) 
  WHERE bank_credit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_bank_id 
  ON accounting_invoices(bank_id) 
  WHERE bank_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_investment_id 
  ON accounting_invoices(investment_id) 
  WHERE investment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_investor_id 
  ON accounting_invoices(investor_id) 
  WHERE investor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_project_id_fkey 
  ON accounting_invoices(project_id) 
  WHERE project_id IS NOT NULL;

-- accounting_payments foreign key index
CREATE INDEX IF NOT EXISTS idx_accounting_payments_created_by_fkey 
  ON accounting_payments(created_by);

-- funding_payments foreign key indexes
CREATE INDEX IF NOT EXISTS idx_funding_payments_bank_id_fkey 
  ON funding_payments(bank_id) 
  WHERE bank_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_funding_payments_investor_id_fkey 
  ON funding_payments(investor_id) 
  WHERE investor_id IS NOT NULL;

-- subcontractors foreign key indexes
CREATE INDEX IF NOT EXISTS idx_subcontractors_financed_by_bank_id 
  ON subcontractors(financed_by_bank_id) 
  WHERE financed_by_bank_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcontractors_financed_by_investor_id 
  ON subcontractors(financed_by_investor_id) 
  WHERE financed_by_investor_id IS NOT NULL;

-- ===================================
-- 2. REMOVE UNUSED INDEXES
-- ===================================

-- accounting_invoices
DROP INDEX IF EXISTS idx_accounting_invoices_created_by;
DROP INDEX IF EXISTS idx_accounting_invoices_category;

-- accounting_payments
DROP INDEX IF EXISTS idx_accounting_payments_cesija_bank_account_id;
DROP INDEX IF EXISTS idx_accounting_payments_cesija_company_id;
DROP INDEX IF EXISTS idx_accounting_payments_company_bank_account_id;

-- apartments
DROP INDEX IF EXISTS idx_apartments_building_id;
DROP INDEX IF EXISTS idx_apartments_garage_id;
DROP INDEX IF EXISTS idx_apartments_project_id;
DROP INDEX IF EXISTS idx_apartments_repository_id;

-- bank_credits
DROP INDEX IF EXISTS idx_bank_credits_bank_id;
DROP INDEX IF EXISTS idx_bank_credits_project_id;

-- buildings
DROP INDEX IF EXISTS idx_buildings_project_id;

-- funding_payments
DROP INDEX IF EXISTS idx_funding_payments_bank_credit_id;
DROP INDEX IF EXISTS idx_funding_payments_created_by;
DROP INDEX IF EXISTS idx_funding_payments_project_investment_id;

-- garages
DROP INDEX IF EXISTS idx_garages_building_id;

-- leads
DROP INDEX IF EXISTS idx_leads_customer_id;
DROP INDEX IF EXISTS idx_leads_project_id;

-- old_invoices
DROP INDEX IF EXISTS idx_old_invoices_project_id;
DROP INDEX IF EXISTS idx_old_invoices_subcontractor_id;

-- project_investments
DROP INDEX IF EXISTS idx_project_investments_bank_id;
DROP INDEX IF EXISTS idx_project_investments_investor_id;
DROP INDEX IF EXISTS idx_project_investments_project_id;

-- project_managers
DROP INDEX IF EXISTS idx_project_managers_assigned_by;

-- project_milestones
DROP INDEX IF EXISTS idx_project_milestones_project_id;

-- repositories
DROP INDEX IF EXISTS idx_repositories_building_id;

-- sales
DROP INDEX IF EXISTS idx_sales_apartment_id;
DROP INDEX IF EXISTS idx_sales_customer_id;

-- subcontractor_comments
DROP INDEX IF EXISTS idx_subcontractor_comments_subcontractor_id;

-- work_logs
DROP INDEX IF EXISTS idx_work_logs_phase_id;
DROP INDEX IF EXISTS idx_work_logs_subcontractor_id;

-- ===================================
-- 3. FIX FUNCTION SEARCH PATH ISSUES
-- ===================================

-- Fix user_has_project_access function
CREATE OR REPLACE FUNCTION user_has_project_access(user_uuid uuid, proj_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role_var text;
BEGIN
  SELECT role INTO user_role_var FROM users WHERE id = user_uuid;
  
  IF user_role_var IN ('Director', 'Investment', 'Sales', 'Accounting') THEN
    RETURN true;
  END IF;
  
  IF user_role_var = 'Supervision' THEN
    RETURN EXISTS (
      SELECT 1 FROM project_managers 
      WHERE user_id = user_uuid AND project_id = proj_id
    );
  END IF;
  
  RETURN false;
END;
$$;

-- Drop and recreate get_subcontractor_payments function with proper search_path
DROP FUNCTION IF EXISTS get_subcontractor_payments(uuid);

CREATE OR REPLACE FUNCTION get_subcontractor_payments(subcontractor_uuid uuid)
RETURNS TABLE (
  payment_id uuid,
  payment_amount numeric,
  payment_date date,
  invoice_description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id as payment_id,
    ap.base_amount as payment_amount,
    ap.payment_date,
    ai.description as invoice_description
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.subcontractor_id = subcontractor_uuid
  ORDER BY ap.payment_date DESC;
END;
$$;
