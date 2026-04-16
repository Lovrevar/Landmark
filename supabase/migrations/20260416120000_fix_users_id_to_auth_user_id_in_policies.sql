-- =============================================================================
-- FIX: 13 RLS policies compared public.users.id = auth.uid(), but the column
-- that links public.users to auth.users is auth_user_id. The bug silently
-- denied reads/writes whenever the two UUIDs diverged (i.e. for every user
-- whose public.users row wasn't seeded with id = auth.users.id).
--
-- Affected policies (found 2026-04-16 via pg_policies scan of test + prod):
--   contract_types      INSERT / UPDATE / DELETE
--   invoice_categories  ALL
--   project_managers    INSERT / UPDATE / SELECT
--   projects            INSERT / UPDATE / DELETE
--   work_logs           INSERT / UPDATE / DELETE
--
-- Each policy's role list, case-folding, and auth.uid() wrapping style are
-- preserved exactly — only the join column is corrected (id -> auth_user_id).
-- Uses DROP POLICY IF EXISTS throughout, so this migration is idempotent and
-- safe to run on any database.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- contract_types
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert contract types" ON contract_types;
DROP POLICY IF EXISTS "Authenticated users can update contract types" ON contract_types;
DROP POLICY IF EXISTS "Directors can delete contract types"           ON contract_types;

CREATE POLICY "Authenticated users can insert contract types"
  ON contract_types FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND lower(users.role) = ANY (ARRAY['director', 'admin', 'project_manager', 'supervision'])
  ));

CREATE POLICY "Authenticated users can update contract types"
  ON contract_types FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND lower(users.role) = ANY (ARRAY['director', 'admin', 'project_manager', 'supervision'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND lower(users.role) = ANY (ARRAY['director', 'admin', 'project_manager', 'supervision'])
  ));

CREATE POLICY "Directors can delete contract types"
  ON contract_types FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND lower(users.role) = ANY (ARRAY['director', 'admin'])
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- invoice_categories
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage invoice categories" ON invoice_categories;

CREATE POLICY "Admins can manage invoice categories"
  ON invoice_categories FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'director'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
      AND users.role = 'director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- project_managers
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Directors can create project manager assignments"   ON project_managers;
DROP POLICY IF EXISTS "Directors can delete project manager assignments"   ON project_managers;
DROP POLICY IF EXISTS "Directors can view all project manager assignments" ON project_managers;

CREATE POLICY "Directors can create project manager assignments"
  ON project_managers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = 'Director'
  ));

CREATE POLICY "Directors can delete project manager assignments"
  ON project_managers FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = 'Director'
  ));

CREATE POLICY "Directors can view all project manager assignments"
  ON project_managers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- projects
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Directors can insert projects" ON projects;
DROP POLICY IF EXISTS "Directors can update projects" ON projects;
DROP POLICY IF EXISTS "Directors can delete projects" ON projects;

CREATE POLICY "Directors can insert projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = 'Director'
  ));

CREATE POLICY "Directors can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = 'Director'
  ));

CREATE POLICY "Directors can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = 'Director'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- work_logs
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Directors and Supervision can create work logs" ON work_logs;
DROP POLICY IF EXISTS "Directors and Supervision can update work logs" ON work_logs;
DROP POLICY IF EXISTS "Directors and Supervision can delete work logs" ON work_logs;

CREATE POLICY "Directors and Supervision can create work logs"
  ON work_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = ANY (ARRAY['Director', 'Supervision'])
  ));

CREATE POLICY "Directors and Supervision can update work logs"
  ON work_logs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = ANY (ARRAY['Director', 'Supervision'])
  ));

CREATE POLICY "Directors and Supervision can delete work logs"
  ON work_logs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = (SELECT auth.uid())
      AND users.role = ANY (ARRAY['Director', 'Supervision'])
  ));
