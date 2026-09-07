-- Fixes a live bug in the phase renumbering path, and makes the 20260908120200 fold safe.
--
-- `project_phases_project_id_phase_number_key` is a plain (non-deferrable) UNIQUE constraint,
-- so it is checked per-row as each row is updated. phaseService.updateProjectPhases and
-- resequencePhases both renumber phases 1..n in a SEQUENTIAL loop of single-row updates, which
-- means swapping phases 1 and 2 transiently sets row A to 2 while row B still holds 2 and the
-- statement fails. It has been survivable only because reordering is rare.
--
-- Two changes, belt and braces:
--   1. Make the constraint DEFERRABLE so a transaction can renumber without transient collisions.
--   2. Add a set-based RPC that renumbers in ONE statement, so the client never needs to defer.
--      supabase-js cannot issue `SET CONSTRAINTS` across separate REST calls, so the RPC is the
--      change that actually fixes the client; the deferrable constraint protects anything that
--      still renumbers row-by-row (including psql sessions and the data migration).
--
-- Nothing in the codebase uses (project_id, phase_number) as an ON CONFLICT / upsert arbiter --
-- phaseService only issues plain insert/update -- so making it deferrable breaks no caller.

ALTER TABLE public.project_phases
    DROP CONSTRAINT project_phases_project_id_phase_number_key;

ALTER TABLE public.project_phases
    ADD CONSTRAINT project_phases_project_id_phase_number_key
    UNIQUE (project_id, phase_number) DEFERRABLE INITIALLY IMMEDIATE;

-- Renumber a project's phases to 1..n in the order given, in a single statement.
--
-- SECURITY INVOKER (the default): the caller's RLS on project_phases applies, so this grants
-- no privilege the user does not already have through the normal update policies.
--
-- p_ordered_ids must list every phase of the project exactly once; anything missing or foreign
-- raises, rather than silently leaving gaps in the numbering.
CREATE OR REPLACE FUNCTION public.renumber_project_phases(
    p_project_id  uuid,
    p_ordered_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_expected integer;
  v_given    integer := array_length(p_ordered_ids, 1);
BEGIN
  SELECT count(*) INTO v_expected
    FROM public.project_phases WHERE project_id = p_project_id;

  IF COALESCE(v_given, 0) <> v_expected THEN
    RAISE EXCEPTION 'renumber_project_phases: got % ids for a project with % phases',
      COALESCE(v_given, 0), v_expected;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) AS given(id)
     WHERE NOT EXISTS (SELECT 1 FROM public.project_phases ph
                        WHERE ph.id = given.id AND ph.project_id = p_project_id)
  ) THEN
    RAISE EXCEPTION 'renumber_project_phases: id list contains a phase from another project';
  END IF;

  SET CONSTRAINTS public.project_phases_project_id_phase_number_key DEFERRED;

  UPDATE public.project_phases ph
     SET phase_number = ordered.rn
    FROM (SELECT id, row_number() OVER (ORDER BY ord) AS rn
            FROM unnest(p_ordered_ids) WITH ORDINALITY AS t(id, ord)) ordered
   WHERE ph.id = ordered.id
     AND ph.phase_number IS DISTINCT FROM ordered.rn;
END $$;

COMMENT ON FUNCTION public.renumber_project_phases(uuid, uuid[]) IS
  'Renumbers a project''s phases to 1..n in the given order, set-based and collision-free. '
  'Replaces the sequential single-row update loops in phaseService.';

GRANT EXECUTE ON FUNCTION public.renumber_project_phases(uuid, uuid[]) TO authenticated;
