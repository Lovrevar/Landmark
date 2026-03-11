/*
  # Fix Projects RLS Policies to Use auth_user_id

  ## Problem
  RLS policies for projects table and user_has_project_access function
  were using `users.id = auth.uid()` which is INCORRECT.
  
  The correct mapping is:
  - `auth.uid()` returns the UUID from auth.users.id
  - `users.auth_user_id` contains the reference to auth.users.id
  - `users.id` is the internal public.users primary key (different!)

  ## Solution
  Update all policies and functions to use `users.auth_user_id = auth.uid()`
  instead of `users.id = auth.uid()`.

  ## Changes
  1. Fix "Directors and general users can view all projects" policy
  2. Fix "Supervision users can view assigned projects" policy  
  3. Fix "Supervision users can view project info through project_manager" policy
  4. Fix user_has_project_access(p_project_id) function
*/

-- 1. Drop and recreate "Directors and general users can view all projects" policy
DROP POLICY IF EXISTS "Directors and general users can view all projects" ON projects;

CREATE POLICY "Directors and general users can view all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role IN ('Director', 'Investment', 'Sales', 'Accounting')
    )
  );

-- 2. Drop and recreate "Supervision users can view assigned projects" policy
DROP POLICY IF EXISTS "Supervision users can view assigned projects" ON projects;

CREATE POLICY "Supervision users can view assigned projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM project_managers pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = projects.id
        AND u.auth_user_id = auth.uid()
        AND u.role = 'Supervision'
    )
  );

-- 3. Drop and recreate "Supervision users can view project info through project_manager" policy
DROP POLICY IF EXISTS "Supervision users can view project info through project_manager" ON projects;

CREATE POLICY "Supervision users can view project info through project_manager"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT pm.project_id
      FROM project_managers pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- 4. Fix user_has_project_access function to use auth_user_id
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
    WHERE auth_user_id = auth.uid()
      AND role = 'Director'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Supervision users have access to assigned projects
  IF EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.project_managers pm ON pm.user_id = u.id
    WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
      AND pm.project_id = p_project_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
