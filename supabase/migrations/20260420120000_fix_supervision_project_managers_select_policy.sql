-- =============================================================================
-- FIX: "Supervision users can view their own assignments" policy on
-- project_managers was deployed with a broken predicate that compares
-- project_managers.user_id directly to auth.uid(). Those values live in
-- different columns (public.users.id vs auth.users.id) and never match, so
-- Supervision users always saw zero assignments (and therefore zero projects).
--
-- The source migration (20251116123726) had the correct subquery form, but
-- the live DB drifted. This migration restores the correct predicate.
-- =============================================================================

DROP POLICY IF EXISTS "Supervision users can view their own assignments" ON public.project_managers;

CREATE POLICY "Supervision users can view their own assignments"
  ON public.project_managers
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );
