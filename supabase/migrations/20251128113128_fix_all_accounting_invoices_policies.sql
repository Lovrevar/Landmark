/*
  # Fix All Accounting Invoices RLS Policies

  ## Problem
  All RLS policies on accounting_invoices use wrong column:
  - Current: users.id = auth.uid()
  - Correct: users.auth_user_id = auth.uid()

  This prevents authenticated users from performing any operations on invoices.

  ## Solution
  Drop and recreate ALL policies with correct column reference.

  ## Safety
  - Only fixes RLS policies
  - Does not touch data
  - Does not modify table structure
*/

-- ============================================================================
-- DROP ALL EXISTING POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Director and Accounting can view all invoices" ON accounting_invoices;
DROP POLICY IF EXISTS "Supervision can view project invoices" ON accounting_invoices;
DROP POLICY IF EXISTS "Director and Accounting can insert invoices" ON accounting_invoices;
DROP POLICY IF EXISTS "Director and Accounting can update invoices" ON accounting_invoices;
DROP POLICY IF EXISTS "Director can delete invoices" ON accounting_invoices;

-- ============================================================================
-- RECREATE ALL POLICIES WITH CORRECT COLUMN REFERENCE
-- ============================================================================

-- SELECT policies
CREATE POLICY "Director and Accounting can view all invoices"
  ON accounting_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Supervision can view project invoices"
  ON accounting_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN project_managers ON project_managers.user_id = users.id
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Supervision'
      AND project_managers.project_id = accounting_invoices.project_id
    )
  );

-- INSERT policy
CREATE POLICY "Director and Accounting can insert invoices"
  ON accounting_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

-- UPDATE policy
CREATE POLICY "Director and Accounting can update invoices"
  ON accounting_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

-- DELETE policy
CREATE POLICY "Director can delete invoices"
  ON accounting_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );
