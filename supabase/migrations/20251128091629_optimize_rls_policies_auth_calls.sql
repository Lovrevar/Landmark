/*
  # Optimize RLS Policies for Auth Function Calls

  ## Performance Enhancement
  
  RLS policies that call auth.uid() or auth.jwt() directly re-evaluate these functions
  for each row, causing significant performance degradation on large tables.
  
  This migration wraps all auth function calls in subqueries to evaluate them once per query.

  ## Changes
  
  Drop and recreate all affected RLS policies with optimized auth function calls:
  - Replace `auth.uid()` with `(select auth.uid())`
  - Replace `auth.jwt()` with `(select auth.jwt())`

  ## Affected Tables
  - subcontractors
  - work_logs
  - office_suppliers
  - users
  - project_managers
  - projects
  - project_phases
  - companies
  - accounting_invoices
*/

-- ================================================================
-- SUBCONTRACTORS POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Directors and Supervision can create subcontractors" ON subcontractors;
CREATE POLICY "Directors and Supervision can create subcontractors"
  ON subcontractors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Supervision')
    )
  );

DROP POLICY IF EXISTS "Directors and Supervision can update subcontractors" ON subcontractors;
CREATE POLICY "Directors and Supervision can update subcontractors"
  ON subcontractors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Supervision')
    )
  );

DROP POLICY IF EXISTS "Directors can delete subcontractors" ON subcontractors;
CREATE POLICY "Directors can delete subcontractors"
  ON subcontractors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

-- ================================================================
-- WORK_LOGS POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Directors and Supervision can create work logs" ON work_logs;
CREATE POLICY "Directors and Supervision can create work logs"
  ON work_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Supervision')
    )
  );

DROP POLICY IF EXISTS "Directors and Supervision can update work logs" ON work_logs;
CREATE POLICY "Directors and Supervision can update work logs"
  ON work_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Supervision')
    )
  );

DROP POLICY IF EXISTS "Directors and Supervision can delete work logs" ON work_logs;
CREATE POLICY "Directors and Supervision can delete work logs"
  ON work_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Supervision')
    )
  );

-- ================================================================
-- OFFICE_SUPPLIERS POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Director and Accounting can view all office suppliers" ON office_suppliers;
CREATE POLICY "Director and Accounting can view all office suppliers"
  ON office_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director and Accounting can insert office suppliers" ON office_suppliers;
CREATE POLICY "Director and Accounting can insert office suppliers"
  ON office_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director and Accounting can update office suppliers" ON office_suppliers;
CREATE POLICY "Director and Accounting can update office suppliers"
  ON office_suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director can delete office suppliers" ON office_suppliers;
CREATE POLICY "Director can delete office suppliers"
  ON office_suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

-- ================================================================
-- USERS POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Allow users to update own record" ON users;
CREATE POLICY "Allow users to update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- ================================================================
-- PROJECT_MANAGERS POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Directors can view all project manager assignments" ON project_managers;
CREATE POLICY "Directors can view all project manager assignments"
  ON project_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

DROP POLICY IF EXISTS "Directors can create project manager assignments" ON project_managers;
CREATE POLICY "Directors can create project manager assignments"
  ON project_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

DROP POLICY IF EXISTS "Directors can delete project manager assignments" ON project_managers;
CREATE POLICY "Directors can delete project manager assignments"
  ON project_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

DROP POLICY IF EXISTS "Supervision users can view their own assignments" ON project_managers;
CREATE POLICY "Supervision users can view their own assignments"
  ON project_managers FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ================================================================
-- PROJECTS POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Directors and general users can view all projects" ON projects;
CREATE POLICY "Directors and general users can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Investment', 'Sales', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Supervision users can view assigned projects" ON projects;
CREATE POLICY "Supervision users can view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_managers pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = projects.id 
      AND pm.user_id = (select auth.uid())
      AND u.role = 'Supervision'
    )
  );

DROP POLICY IF EXISTS "Supervision users can view project info through project_manager" ON projects;
CREATE POLICY "Supervision users can view project info through project_manager"
  ON projects FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT project_id 
      FROM project_managers 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Directors can insert projects" ON projects;
CREATE POLICY "Directors can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

DROP POLICY IF EXISTS "Directors can update projects" ON projects;
CREATE POLICY "Directors can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

DROP POLICY IF EXISTS "Directors can delete projects" ON projects;
CREATE POLICY "Directors can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

-- ================================================================
-- PROJECT_PHASES POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Directors and general users can view all phases" ON project_phases;
CREATE POLICY "Directors and general users can view all phases"
  ON project_phases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Investment', 'Sales', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Supervision users can view phases from assigned projects" ON project_phases;
CREATE POLICY "Supervision users can view phases from assigned projects"
  ON project_phases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_managers pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = project_phases.project_id 
      AND pm.user_id = (select auth.uid())
      AND u.role = 'Supervision'
    )
  );

DROP POLICY IF EXISTS "Directors can insert phases" ON project_phases;
CREATE POLICY "Directors can insert phases"
  ON project_phases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

DROP POLICY IF EXISTS "Directors can update phases" ON project_phases;
CREATE POLICY "Directors can update phases"
  ON project_phases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

DROP POLICY IF EXISTS "Directors can delete phases" ON project_phases;
CREATE POLICY "Directors can delete phases"
  ON project_phases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

-- ================================================================
-- COMPANIES POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Director and Accounting can view all companies" ON companies;
CREATE POLICY "Director and Accounting can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director and Accounting can insert companies" ON companies;
CREATE POLICY "Director and Accounting can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director and Accounting can update companies" ON companies;
CREATE POLICY "Director and Accounting can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director can delete companies" ON companies;
CREATE POLICY "Director can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );

-- ================================================================
-- ACCOUNTING_INVOICES POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Director and Accounting can view all invoices" ON accounting_invoices;
CREATE POLICY "Director and Accounting can view all invoices"
  ON accounting_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Supervision can view project invoices" ON accounting_invoices;
CREATE POLICY "Supervision can view project invoices"
  ON accounting_invoices FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id 
      FROM project_managers 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Director and Accounting can insert invoices" ON accounting_invoices;
CREATE POLICY "Director and Accounting can insert invoices"
  ON accounting_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director and Accounting can update invoices" ON accounting_invoices;
CREATE POLICY "Director and Accounting can update invoices"
  ON accounting_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('Director', 'Accounting')
    )
  );

DROP POLICY IF EXISTS "Director can delete invoices" ON accounting_invoices;
CREATE POLICY "Director can delete invoices"
  ON accounting_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'Director'
    )
  );
