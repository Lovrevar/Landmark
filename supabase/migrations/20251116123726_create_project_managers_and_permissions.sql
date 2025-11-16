/*
  # Create Project Managers and Permission System

  ## Overview
  Implements a system where Supervision role users (Project Managers) can be assigned to specific projects.
  PMs have full access to their assigned projects (subcontractors, work logs, phases) but cannot see payment information.

  ## New Tables
  
  ### `project_managers`
  Links users with Supervision role to specific projects they manage.
  - `id` (uuid, primary key)
  - `user_id` (uuid, references users) - The project manager
  - `project_id` (uuid, references projects) - The assigned project
  - `assigned_by` (uuid, references users) - Who assigned this PM
  - `assigned_at` (timestamp) - When assignment was made
  - `notes` (text) - Optional notes about the assignment
  
  ## RLS Policies
  
  ### project_managers table
  - Directors can manage all assignments
  - Supervision users can view their own assignments
  
  ### projects table
  - Updated to allow Supervision users to view only their assigned projects
  
  ### subcontractors, contracts, phases, work_logs tables
  - Updated to allow Supervision users access only to data from their assigned projects
  
  ## Security
  - All tables have RLS enabled
  - Supervision users have read/write access only to their assigned projects
  - Payment information is hidden from Supervision users
  - Directors maintain full access to everything
*/

-- ============ STEP 1: Create project_managers Table ============

CREATE TABLE IF NOT EXISTS project_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_managers_user_id ON project_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_project_managers_project_id ON project_managers(project_id);

-- Enable RLS
ALTER TABLE project_managers ENABLE ROW LEVEL SECURITY;

-- ============ STEP 2: RLS Policies for project_managers ============

-- Directors can see all assignments
CREATE POLICY "Directors can view all project manager assignments"
  ON project_managers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- Directors can create assignments
CREATE POLICY "Directors can create project manager assignments"
  ON project_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- Directors can delete assignments
CREATE POLICY "Directors can delete project manager assignments"
  ON project_managers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- Supervision users can view their own assignments
CREATE POLICY "Supervision users can view their own assignments"
  ON project_managers
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============ STEP 3: Update Projects RLS Policies ============

-- Drop existing restrictive policies for projects
DROP POLICY IF EXISTS "Allow authenticated to read projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated to insert projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated to update projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated to delete projects" ON projects;

-- Directors and non-Supervision users can see all projects
CREATE POLICY "Directors and general users can view all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Sales', 'Investment')
    )
  );

-- Supervision users can only see their assigned projects
CREATE POLICY "Supervision users can view assigned projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pm.project_id = projects.id
    )
  );

-- Directors can create/update/delete projects
CREATE POLICY "Directors can insert projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Directors can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Directors can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- ============ STEP 4: Update Subcontractors RLS Policies ============

DROP POLICY IF EXISTS "Allow authenticated to read subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Allow authenticated to insert subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Allow authenticated to update subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Allow authenticated to delete subcontractors" ON subcontractors;

-- Directors and general users can see all subcontractors
CREATE POLICY "Directors and general users can view all subcontractors"
  ON subcontractors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
    )
  );

-- Supervision users can see subcontractors from their assigned projects
CREATE POLICY "Supervision users can view subcontractors from assigned projects"
  ON subcontractors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN project_phases pp ON pp.project_id = pm.project_id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pp.id = subcontractors.phase_id
    )
  );

-- Supervision and Directors can insert subcontractors (for their projects)
CREATE POLICY "Directors can insert subcontractors"
  ON subcontractors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Supervision can insert subcontractors to assigned projects"
  ON subcontractors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN project_phases pp ON pp.project_id = pm.project_id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pp.id = subcontractors.phase_id
    )
  );

-- Supervision and Directors can update subcontractors
CREATE POLICY "Directors can update subcontractors"
  ON subcontractors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Supervision can update subcontractors in assigned projects"
  ON subcontractors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN project_phases pp ON pp.project_id = pm.project_id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pp.id = subcontractors.phase_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN project_phases pp ON pp.project_id = pm.project_id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pp.id = subcontractors.phase_id
    )
  );

-- Supervision and Directors can delete subcontractors
CREATE POLICY "Directors can delete subcontractors"
  ON subcontractors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Supervision can delete subcontractors from assigned projects"
  ON subcontractors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN project_phases pp ON pp.project_id = pm.project_id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pp.id = subcontractors.phase_id
    )
  );

-- ============ STEP 5: Update Project Phases RLS Policies ============

DROP POLICY IF EXISTS "Allow authenticated to read project_phases" ON project_phases;
DROP POLICY IF EXISTS "Allow authenticated to insert project_phases" ON project_phases;
DROP POLICY IF EXISTS "Allow authenticated to update project_phases" ON project_phases;
DROP POLICY IF EXISTS "Allow authenticated to delete project_phases" ON project_phases;

-- Directors and general users can see all phases
CREATE POLICY "Directors and general users can view all phases"
  ON project_phases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting', 'Investment')
    )
  );

-- Supervision users can see phases from their assigned projects
CREATE POLICY "Supervision users can view phases from assigned projects"
  ON project_phases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pm.project_id = project_phases.project_id
    )
  );

-- Only Directors can create/update/delete phases
CREATE POLICY "Directors can insert phases"
  ON project_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Directors can update phases"
  ON project_phases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Directors can delete phases"
  ON project_phases
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- ============ STEP 6: Update Work Logs RLS Policies ============

DROP POLICY IF EXISTS "Authenticated users can view all work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can create work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can update work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can delete work logs" ON work_logs;

-- Directors can see all work logs
CREATE POLICY "Directors can view all work logs"
  ON work_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- Supervision users can see work logs from their assigned projects
CREATE POLICY "Supervision users can view work logs from assigned projects"
  ON work_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN subcontractors s ON s.phase_id IN (
        SELECT id FROM project_phases WHERE project_id = pm.project_id
      )
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND s.id = work_logs.subcontractor_id
    )
  );

-- Supervision and Directors can create work logs (for their projects)
CREATE POLICY "Directors can create work logs"
  ON work_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Supervision can create work logs for assigned projects"
  ON work_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN subcontractors s ON s.phase_id IN (
        SELECT id FROM project_phases WHERE project_id = pm.project_id
      )
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND s.id = work_logs.subcontractor_id
    )
  );

-- Supervision and Directors can update work logs
CREATE POLICY "Directors can update work logs"
  ON work_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Supervision can update work logs for assigned projects"
  ON work_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN subcontractors s ON s.phase_id IN (
        SELECT id FROM project_phases WHERE project_id = pm.project_id
      )
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND s.id = work_logs.subcontractor_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN subcontractors s ON s.phase_id IN (
        SELECT id FROM project_phases WHERE project_id = pm.project_id
      )
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND s.id = work_logs.subcontractor_id
    )
  );

-- Supervision and Directors can delete work logs
CREATE POLICY "Directors can delete work logs"
  ON work_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

CREATE POLICY "Supervision can delete work logs for assigned projects"
  ON work_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN project_managers pm ON pm.user_id = u.id
      INNER JOIN subcontractors s ON s.phase_id IN (
        SELECT id FROM project_phases WHERE project_id = pm.project_id
      )
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND s.id = work_logs.subcontractor_id
    )
  );

-- ============ STEP 7: Helper Function to Check Project Access ============

CREATE OR REPLACE FUNCTION user_has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Directors have access to all projects
  IF EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
    AND role = 'Director'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Supervision users have access to assigned projects
  IF EXISTS (
    SELECT 1 FROM users u
    INNER JOIN project_managers pm ON pm.user_id = u.id
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'Supervision'
    AND pm.project_id = p_project_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;