/*
  # Funding: investor rename, TIC saves

  DEFECT_BACKLOG FUND-1 and FUND-2.

  1. Renaming an investor failed (FUND-1)
     trigger_update_bank_in_accounting_companies ran
     `UPDATE accounting_companies SET name = NEW.name WHERE bank_id = NEW.id` on every rename, but
     accounting_companies.bank_id was dropped in 20260203113055, so the UPDATE raised and the rename
     was rolled back. The link it maintained no longer exists; the trigger and its function go.

  2. TIC saves (FUND-2)
     - The INSERT policy compared auth.uid() with created_by, while created_by is a foreign key to
       public.users(id) and the client sends that id. The two differ for every user, so a project's
       first TIC could not be saved. The check now compares with the caller's public.users.id.
     - The TIC is the only writer of planned budget (projects.budget, project_phases,
       phase_classification_budgets). Its INSERT/UPDATE/DELETE were open to anyone who could see
       the project (Sales sees them all); they are now Director, Accounting and Investment — the
       roles that work in the Funding profile.
     - sync_project_from_tic() ran as the caller (SECURITY INVOKER), so for Accounting and
       Investment its writes to project_phases and phase_classification_budgets (Director and
       Supervision only) violated RLS and aborted the save, and its projects.budget update was
       silently dropped. The derived writes now run as the owner (SECURITY DEFINER), gated by the
       TIC policies above; direct EXECUTE on the sync function is revoked.
*/

-- ---------------------------------------------------------------------------
-- 1. Investor rename
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_update_bank_in_accounting_companies ON public.banks;
DROP FUNCTION IF EXISTS public.update_bank_in_accounting_companies();

-- ---------------------------------------------------------------------------
-- 2. TIC write policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can create TIC cost structures for projects"      ON public.tic_cost_structures;
DROP POLICY IF EXISTS "Users can update TIC cost structures for their projects" ON public.tic_cost_structures;
DROP POLICY IF EXISTS "Users can delete TIC cost structures for their projects" ON public.tic_cost_structures;
DROP POLICY IF EXISTS "Funding roles can create TIC cost structures"            ON public.tic_cost_structures;
DROP POLICY IF EXISTS "Funding roles can update TIC cost structures"            ON public.tic_cost_structures;
DROP POLICY IF EXISTS "Funding roles can delete TIC cost structures"            ON public.tic_cost_structures;

CREATE POLICY "Funding roles can create TIC cost structures" ON public.tic_cost_structures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.app_user_role() = ANY (ARRAY['Director', 'Accounting', 'Investment'])
    AND created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Funding roles can update TIC cost structures" ON public.tic_cost_structures
  FOR UPDATE TO authenticated
  USING (public.app_user_role() = ANY (ARRAY['Director', 'Accounting', 'Investment']))
  WITH CHECK (public.app_user_role() = ANY (ARRAY['Director', 'Accounting', 'Investment']));

CREATE POLICY "Funding roles can delete TIC cost structures" ON public.tic_cost_structures
  FOR DELETE TO authenticated
  USING (public.app_user_role() = ANY (ARRAY['Director', 'Accounting', 'Investment']));

-- ---------------------------------------------------------------------------
-- 3. Derived budget writes run as the owner
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.sync_project_from_tic(uuid) SECURITY DEFINER;
ALTER FUNCTION public.sync_project_from_tic(uuid) SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.sync_project_budget_from_tic() SECURITY DEFINER;
ALTER FUNCTION public.sync_project_budget_from_tic() SET search_path TO 'public', 'pg_temp';

REVOKE ALL ON FUNCTION public.sync_project_from_tic(uuid) FROM public, anon, authenticated;
