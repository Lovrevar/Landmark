/*
  # Fix project_phases RLS Policies to Use auth_user_id
  
  ## Problem
  RLS policies on project_phases table were comparing users.id with auth.uid()
  which always fails because auth.uid() returns the UUID from auth.users table,
  not from public.users.id.
  
  ## Solution
  Update all project_phases policies to use users.auth_user_id instead of users.id
  when comparing with auth.uid().
  
  ## Changes
  - Drop existing policies on project_phases
  - Recreate all policies with corrected user lookup using auth_user_id
*/

-- Drop all existing policies on project_phases
DROP POLICY IF EXISTS "Directors and general users can view all phases" ON project_phases;
DROP POLICY IF EXISTS "Supervision users can view phases from assigned projects" ON project_phases;
DROP POLICY IF EXISTS "Directors can insert phases" ON project_phases;
DROP POLICY IF EXISTS "Directors can update phases" ON project_phases;
DROP POLICY IF EXISTS "Directors can delete phases" ON project_phases;

-- SELECT: Directors and general users can view all phases
CREATE POLICY "Directors and general users can view all phases"
  ON project_phases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role IN ('Director', 'Investment', 'Sales', 'Accounting')
    )
  );

-- SELECT: Supervision users can view phases from assigned projects
CREATE POLICY "Supervision users can view phases from assigned projects"
  ON project_phases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM project_managers pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = project_phases.project_id
        AND u.auth_user_id = auth.uid()
        AND u.role = 'Supervision'
    )
  );

-- INSERT: Directors can insert phases
CREATE POLICY "Directors can insert phases"
  ON project_phases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'Director'
    )
  );

-- UPDATE: Directors can update phases
CREATE POLICY "Directors can update phases"
  ON project_phases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'Director'
    )
  );

-- DELETE: Directors can delete phases
CREATE POLICY "Directors can delete phases"
  ON project_phases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'Director'
    )
  );
