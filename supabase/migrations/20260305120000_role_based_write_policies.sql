-- =============================================================================
-- ROLE-BASED WRITE POLICIES
-- Date: 2026-03-05
--
-- SELECT stays open (USING true) for all authenticated users.
-- Only INSERT / UPDATE / DELETE are role-restricted.
--
-- Role assignments:
--   banks, bank_credits, investors, project_investments,
--     funding_payments, credit_allocations → Director, Accounting, Investment
--   customers, sales                       → Director, Sales, Accounting
--   subcontractors, contracts              → Director, Accounting, Supervision
--   project_phases, work_logs             → Director, Supervision
--   old_invoices                           → Director, Accounting
--   DELETE on all tables                   → Director only
--
-- Safe to run multiple times (all DROPs use IF EXISTS).
-- Does NOT touch data or SELECT policies.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- banks
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert banks" ON banks;
DROP POLICY IF EXISTS "Allow authenticated to update banks" ON banks;
DROP POLICY IF EXISTS "Allow authenticated to delete banks" ON banks;

CREATE POLICY "Finance roles can insert banks"
  ON banks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Finance roles can update banks"
  ON banks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Director can delete banks"
  ON banks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- bank_credits
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Allow authenticated to update bank_credits" ON bank_credits;
DROP POLICY IF EXISTS "Allow authenticated to delete bank_credits" ON bank_credits;

CREATE POLICY "Finance roles can insert bank_credits"
  ON bank_credits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Finance roles can update bank_credits"
  ON bank_credits FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Director can delete bank_credits"
  ON bank_credits FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- investors
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert investors" ON investors;
DROP POLICY IF EXISTS "Allow authenticated to update investors" ON investors;
DROP POLICY IF EXISTS "Allow authenticated to delete investors" ON investors;

CREATE POLICY "Finance roles can insert investors"
  ON investors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Finance roles can update investors"
  ON investors FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Director can delete investors"
  ON investors FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- project_investments
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert project_investments" ON project_investments;
DROP POLICY IF EXISTS "Allow authenticated to update project_investments" ON project_investments;
DROP POLICY IF EXISTS "Allow authenticated to delete project_investments" ON project_investments;

CREATE POLICY "Finance roles can insert project_investments"
  ON project_investments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Finance roles can update project_investments"
  ON project_investments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Director can delete project_investments"
  ON project_investments FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- funding_payments
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert funding_payments" ON funding_payments;
DROP POLICY IF EXISTS "Allow authenticated to update funding_payments" ON funding_payments;
DROP POLICY IF EXISTS "Allow authenticated to delete funding_payments" ON funding_payments;

CREATE POLICY "Finance roles can insert funding_payments"
  ON funding_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Finance roles can update funding_payments"
  ON funding_payments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Director can delete funding_payments"
  ON funding_payments FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- credit_allocations
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert credit_allocations" ON credit_allocations;
DROP POLICY IF EXISTS "Allow authenticated to update credit_allocations" ON credit_allocations;
DROP POLICY IF EXISTS "Allow authenticated to delete credit_allocations" ON credit_allocations;

CREATE POLICY "Finance roles can insert credit_allocations"
  ON credit_allocations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Finance roles can update credit_allocations"
  ON credit_allocations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
  ));

CREATE POLICY "Director can delete credit_allocations"
  ON credit_allocations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- customers
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated to update customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated to delete customers" ON customers;

CREATE POLICY "Sales roles can insert customers"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Sales', 'Accounting')
  ));

CREATE POLICY "Sales roles can update customers"
  ON customers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Sales', 'Accounting')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Sales', 'Accounting')
  ));

CREATE POLICY "Director can delete customers"
  ON customers FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- sales
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated to update sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated to delete sales" ON sales;

CREATE POLICY "Sales roles can insert sales"
  ON sales FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Sales', 'Accounting')
  ));

CREATE POLICY "Sales roles can update sales"
  ON sales FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Sales', 'Accounting')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Sales', 'Accounting')
  ));

CREATE POLICY "Director can delete sales"
  ON sales FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- subcontractors
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Allow authenticated to update subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Allow authenticated to delete subcontractors" ON subcontractors;

CREATE POLICY "Site roles can insert subcontractors"
  ON subcontractors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Supervision')
  ));

CREATE POLICY "Site roles can update subcontractors"
  ON subcontractors FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Supervision')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Supervision')
  ));

CREATE POLICY "Director can delete subcontractors"
  ON subcontractors FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- contracts
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert contracts" ON contracts;
DROP POLICY IF EXISTS "Allow authenticated to update contracts" ON contracts;
DROP POLICY IF EXISTS "Allow authenticated to delete contracts" ON contracts;
-- Drop any role-based write policies from earlier migrations
DROP POLICY IF EXISTS "Director and Accounting can insert contracts" ON contracts;
DROP POLICY IF EXISTS "Director and Accounting can update contracts" ON contracts;
DROP POLICY IF EXISTS "Director can delete contracts" ON contracts;

CREATE POLICY "Site roles can insert contracts"
  ON contracts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Supervision')
  ));

CREATE POLICY "Site roles can update contracts"
  ON contracts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Supervision')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Supervision')
  ));

CREATE POLICY "Director can delete contracts"
  ON contracts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- project_phases
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert project_phases" ON project_phases;
DROP POLICY IF EXISTS "Allow authenticated to update project_phases" ON project_phases;
DROP POLICY IF EXISTS "Allow authenticated to delete project_phases" ON project_phases;
-- Drop any role-based write policies from earlier migrations
DROP POLICY IF EXISTS "Director and Supervision can insert project_phases" ON project_phases;
DROP POLICY IF EXISTS "Director and Supervision can update project_phases" ON project_phases;
DROP POLICY IF EXISTS "Director can delete project_phases" ON project_phases;

CREATE POLICY "Director and Supervision can insert project_phases"
  ON project_phases FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
  ));

CREATE POLICY "Director and Supervision can update project_phases"
  ON project_phases FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
  ));

CREATE POLICY "Director can delete project_phases"
  ON project_phases FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- work_logs
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert work_logs" ON work_logs;
DROP POLICY IF EXISTS "Allow authenticated to update work_logs" ON work_logs;
DROP POLICY IF EXISTS "Allow authenticated to delete work_logs" ON work_logs;
-- Drop any role-based write policies from earlier migrations
DROP POLICY IF EXISTS "Director and Supervision can insert work_logs" ON work_logs;
DROP POLICY IF EXISTS "Director and Supervision can update work_logs" ON work_logs;
DROP POLICY IF EXISTS "Director can delete work_logs" ON work_logs;

CREATE POLICY "Director and Supervision can insert work_logs"
  ON work_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
  ));

CREATE POLICY "Director and Supervision can update work_logs"
  ON work_logs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
  ));

CREATE POLICY "Director can delete work_logs"
  ON work_logs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- old_invoices
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert old_invoices" ON old_invoices;
DROP POLICY IF EXISTS "Allow authenticated to update old_invoices" ON old_invoices;
DROP POLICY IF EXISTS "Allow authenticated to delete old_invoices" ON old_invoices;

CREATE POLICY "Accounting roles can insert old_invoices"
  ON old_invoices FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));

CREATE POLICY "Accounting roles can update old_invoices"
  ON old_invoices FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));

CREATE POLICY "Director can delete old_invoices"
  ON old_invoices FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
  ));
