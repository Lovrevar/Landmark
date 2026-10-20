/*
  # Contracts and milestones follow project assignment (SEC-004); drop an unused overload (AUTH-4)

  `projects` and `project_phases` already limit a Supervision user to the projects they are
  assigned to in `project_managers`. `contracts` and `subcontractor_milestones` did not: every
  signed-in user could read every contract on every project (`USING (true)`), and a Supervision
  user could insert and update contracts on projects that are not theirs. Both tables now follow
  the same rule as phases.

  1. public.app_can_access_project(project_id)
     True for Director, Accounting, Investment and Sales (the roles that see every project and
     phase today), and for a Supervision user with a `project_managers` row for the project.

  2. public.contracts
     | Command | Before                                   | After                                             |
     |---------|------------------------------------------|---------------------------------------------------|
     | SELECT  | every signed-in user                     | app_can_access_project(project_id)                |
     | INSERT  | Director, Accounting, Supervision (any)  | Director, Accounting; Supervision on own projects |
     | UPDATE  | Director, Accounting, Supervision (any)  | Director, Accounting; Supervision on own projects |
     | DELETE  | Director                                 | Director (unchanged)                              |
     The two INSERT and two UPDATE policies were duplicates of each other; one of each remains.

  3. public.subcontractor_milestones
     Reading and writing a milestone now also requires being able to read its contract. The check
     is a subquery on `contracts`, which runs under the caller's own RLS, so milestones inherit
     the rule above without restating it.

  4. public.user_has_project_access(uuid, uuid) is dropped (AUTH-4). Nothing calls it — no policy,
     no function, no application code — and it disagrees with the one-argument function that the
     `project_milestones` policy does use: it also lets Accounting, Sales and Investment in. The
     guard below refuses to drop it if anything has started using it.

  What this does NOT close (SEC-004, accepted risk):
    - A Supervision user can still read `budget_realized` — what has been paid — on the contracts
      of their own projects. The screens hide it; the database does not. Hiding it would mean
      taking the figure out of this table, which about forty reads depend on, some of them for
      budget arithmetic.
    - Sales and Investment still read every contract, exactly as they read every phase.

  Not touched: `retail_contracts`. The policy "Supervision can view invoices for managed projects"
  on `accounting_invoices` joins `contracts` and narrows by itself.

  Idempotent: every policy is dropped before it is created.
*/

-- ---------------------------------------------------------------------------
-- 1. Project access, as the phase policies already define it
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_can_access_project(p_project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (
        u.role IN ('Director', 'Accounting', 'Investment', 'Sales')
        OR (
          u.role = 'Supervision'
          AND EXISTS (
            SELECT 1 FROM public.project_managers pm
            WHERE pm.user_id = u.id AND pm.project_id = p_project_id
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.app_can_access_project(uuid) IS
  'Whether the caller may see a project''s contracts and milestones: Director, Accounting, '
  'Investment and Sales always; Supervision only when assigned in project_managers. The same '
  'split the project_phases SELECT policies make.';

REVOKE ALL ON FUNCTION public.app_can_access_project(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.app_can_access_project(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. contracts
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can read contracts"                     ON public.contracts;
DROP POLICY IF EXISTS "Directors, Supervision and Accounting can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Site roles can insert contracts"                            ON public.contracts;
DROP POLICY IF EXISTS "Directors, Supervision and Accounting can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Site roles can update contracts"                            ON public.contracts;
DROP POLICY IF EXISTS "Director can delete contracts"                              ON public.contracts;

DROP POLICY IF EXISTS "Project roles can read contracts"   ON public.contracts;
CREATE POLICY "Project roles can read contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (public.app_can_access_project(project_id));

DROP POLICY IF EXISTS "Site roles can insert contracts on their projects" ON public.contracts;
CREATE POLICY "Site roles can insert contracts on their projects" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.app_user_role() IN ('Director', 'Accounting')
    OR (public.app_user_role() = 'Supervision' AND public.app_can_access_project(project_id))
  );

DROP POLICY IF EXISTS "Site roles can update contracts on their projects" ON public.contracts;
CREATE POLICY "Site roles can update contracts on their projects" ON public.contracts
  FOR UPDATE TO authenticated
  USING (
    public.app_user_role() IN ('Director', 'Accounting')
    OR (public.app_user_role() = 'Supervision' AND public.app_can_access_project(project_id))
  )
  WITH CHECK (
    public.app_user_role() IN ('Director', 'Accounting')
    OR (public.app_user_role() = 'Supervision' AND public.app_can_access_project(project_id))
  );

CREATE POLICY "Director can delete contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (public.app_user_role() = 'Director');

-- ---------------------------------------------------------------------------
-- 3. subcontractor_milestones: visible and writable only with their contract
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view milestones"        ON public.subcontractor_milestones;
DROP POLICY IF EXISTS "Site roles can manage milestones"               ON public.subcontractor_milestones;
DROP POLICY IF EXISTS "Milestones are readable with their contract"    ON public.subcontractor_milestones;
DROP POLICY IF EXISTS "Site roles can manage milestones on their contracts" ON public.subcontractor_milestones;

CREATE POLICY "Milestones are readable with their contract" ON public.subcontractor_milestones
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = subcontractor_milestones.contract_id));

CREATE POLICY "Site roles can manage milestones on their contracts" ON public.subcontractor_milestones
  FOR ALL TO authenticated
  USING (
    public.app_user_role() IN ('Director', 'Supervision', 'Accounting')
    AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = subcontractor_milestones.contract_id)
  )
  WITH CHECK (
    public.app_user_role() IN ('Director', 'Supervision', 'Accounting')
    AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = subcontractor_milestones.contract_id)
  );

-- ---------------------------------------------------------------------------
-- 4. AUTH-4: the unused two-argument overload
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_users text;
BEGIN
  -- A call with two arguments has a comma inside the parentheses; the one-argument function,
  -- which the project_milestones policy uses, does not.
  SELECT string_agg(found.what, ', ') INTO v_users
  FROM (
    SELECT 'policy ' || policyname || ' on ' || tablename AS what
    FROM pg_policies
    WHERE COALESCE(qual, '') || ' ' || COALESCE(with_check, '') ~ 'user_has_project_access\([^()]*,'
    UNION ALL
    SELECT 'function ' || p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname <> 'user_has_project_access'
      AND p.prosrc ~ 'user_has_project_access\([^()]*,'
  ) found;

  IF v_users IS NOT NULL THEN
    RAISE EXCEPTION 'user_has_project_access(uuid, uuid) is in use by: %. Not dropped.', v_users;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.user_has_project_access(uuid, uuid);

-- ---------------------------------------------------------------------------
-- Manual check after applying (read-only):
--
--   SELECT tablename, cmd, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('contracts', 'subcontractor_milestones')
--   ORDER BY 1, 2;
--   -- expect 4 on contracts (SELECT, INSERT, UPDATE, DELETE) and 2 on subcontractor_milestones
--
--   SELECT pg_get_function_identity_arguments(oid) FROM pg_proc
--   WHERE proname = 'user_has_project_access';        -- expect one row: p_project_id uuid
--
-- A Supervision user sees nothing until they have a row in project_managers; on 2026-10-12
-- production had one Supervision user and no such rows.
-- ---------------------------------------------------------------------------
