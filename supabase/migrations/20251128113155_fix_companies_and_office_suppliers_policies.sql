/*
  # Fix Companies and Office Suppliers RLS Policies

  ## Problem
  RLS policies on 'companies' and 'office_suppliers' tables use wrong column:
  - Current: users.id = auth.uid()
  - Correct: users.auth_user_id = auth.uid()

  ## Solution
  Drop and recreate all policies with correct column reference.

  ## Safety
  - Only fixes RLS policies
  - Does not touch data
*/

-- ============================================================================
-- FIX COMPANIES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Director and Accounting can view all companies" ON companies;
DROP POLICY IF EXISTS "Director and Accounting can insert companies" ON companies;
DROP POLICY IF EXISTS "Director and Accounting can update companies" ON companies;
DROP POLICY IF EXISTS "Director can delete companies" ON companies;

CREATE POLICY "Director and Accounting can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can update companies"
  ON companies FOR UPDATE
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

CREATE POLICY "Director can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- ============================================================================
-- FIX OFFICE_SUPPLIERS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Director and Accounting can view all office suppliers" ON office_suppliers;
DROP POLICY IF EXISTS "Director and Accounting can insert office suppliers" ON office_suppliers;
DROP POLICY IF EXISTS "Director and Accounting can update office suppliers" ON office_suppliers;
DROP POLICY IF EXISTS "Director can delete office suppliers" ON office_suppliers;

CREATE POLICY "Director and Accounting can view all office suppliers"
  ON office_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can insert office suppliers"
  ON office_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can update office suppliers"
  ON office_suppliers FOR UPDATE
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

CREATE POLICY "Director can delete office suppliers"
  ON office_suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );
