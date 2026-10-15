/*
  # An unphased TIC no longer puts the whole budget on phase 1 (GEN-22)

  A TIC with no phased line describes one undifferentiated project. `sync_project_from_tic`
  nevertheless wrote its whole total onto phase 1 and 0 onto every other phase, so a project with
  several phases showed:
  - phase 1 with the entire project budget and phases 2+ with "Budžet nije postavljen" in
    Faze i ugovori;
  - the same split on Site Management's phase cards;
  - phase 1 capped at the whole project budget for its own contracts only, and phases 2+ not
    capped at all;
  - every classification budget on phase 1.
  Budget Control's EVM was patched on the client in 01017b1c; this fixes the data.

  After this, `project_phases.budget_allocated` means:
  - a number — that phase's share of a phased TIC (0: the TIC plans nothing for it, or there is
    no TIC);
  - NULL — the TIC is not split by phase and the project has several phases: the project budget
    covers them together and no phase has a share of its own. There are no
    `phase_classification_budgets` rows for such a project, since the plan has no per-phase split.
  A project with an unphased TIC and a single phase is unchanged: that phase holds the whole plan
  and its classification split.

  Phase count can change after the TIC is saved — Site Management adds and deletes phases, and
  nothing re-ran the sync — so a new trigger on `project_phases` re-applies the unphased split
  when a phase is inserted, deleted or moved. It never re-runs the full sync: for a phased TIC
  that would delete a phase a user just added above the TIC's count.

  `CREATE OR REPLACE` resets what 20260930100400 set with `ALTER FUNCTION`, so every function
  here states SECURITY DEFINER and its search_path in its own header.
*/

-- ---------------------------------------------------------------------------
-- 1. The unphased split, on its own
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_unphased_tic_budget(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_line_items jsonb;
  v_total      numeric;
  v_phases     integer;
  v_only_phase uuid;
BEGIN
  -- Called from the project_phases trigger while a project is being deleted: its phases go by
  -- cascade after the project row, and there is nothing left to split.
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RETURN;
  END IF;

  SELECT line_items INTO v_line_items
    FROM public.tic_cost_structures WHERE project_id = p_project_id;

  IF v_line_items IS NULL THEN
    RETURN;                                   -- no TIC: budgets stay unset
  END IF;

  -- A phased TIC is the full sync's to apply, never this function's.
  IF EXISTS (SELECT 1 FROM public.tic_phase_totals(v_line_items)) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric), 0)
    INTO v_total FROM jsonb_array_elements(v_line_items) li;

  -- The all-zero template guard, as in sync_project_from_tic.
  IF v_total <= 0 THEN
    RETURN;
  END IF;

  -- Two sessions each deleting one of three phases would otherwise both count two and leave the
  -- survivor at NULL.
  PERFORM pg_advisory_xact_lock(hashtextextended('apply_unphased_tic_budget:' || p_project_id::text, 0));

  SELECT count(*), (array_agg(id))[1] INTO v_phases, v_only_phase
    FROM public.project_phases WHERE project_id = p_project_id;

  IF v_phases = 0 THEN
    RETURN;                                   -- creating the first phase is the sync's job
  END IF;

  DELETE FROM public.phase_classification_budgets b
   USING public.project_phases ph
   WHERE b.phase_id = ph.id AND ph.project_id = p_project_id;

  IF v_phases = 1 THEN
    -- The only phase holds the whole plan, whatever its number.
    UPDATE public.project_phases SET budget_allocated = v_total WHERE id = v_only_phase;

    INSERT INTO public.phase_classification_budgets (phase_id, classification_id, budget_allocated)
    SELECT v_only_phase, (li->>'classification_id')::integer,
           SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric)
      FROM jsonb_array_elements(v_line_items) li
     WHERE li->>'classification_id' IS NOT NULL
     GROUP BY (li->>'classification_id')::integer
    HAVING SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric) > 0;
  ELSE
    -- The plan does not distinguish the phases, so none of them has a share of it.
    UPDATE public.project_phases SET budget_allocated = NULL
     WHERE project_id = p_project_id AND budget_allocated IS NOT NULL;
  END IF;
END $$;

COMMENT ON FUNCTION public.apply_unphased_tic_budget(uuid) IS
  'For a project whose TIC has no phased line: gives its only phase the whole plan and the '
  'classification split, or, with several phases, sets every phase budget to NULL and writes no '
  'classification budgets. Does nothing for a phased TIC, an all-zero TIC or no TIC. Never '
  'inserts or deletes a phase (GEN-22).';

REVOKE ALL ON FUNCTION public.apply_unphased_tic_budget(uuid) FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The sync, with the unphased branch handed to the function above
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_project_from_tic(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_line_items  jsonb;
  v_total       numeric;
  v_phase_count integer;
  v_rec         record;
BEGIN
  SELECT line_items INTO v_line_items
    FROM public.tic_cost_structures WHERE project_id = p_project_id;

  IF v_line_items IS NULL THEN
    RETURN;                                   -- no TIC: budgets stay unset
  END IF;

  SELECT COALESCE(SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric), 0)
    INTO v_total FROM jsonb_array_elements(v_line_items) li;

  -- An untouched template saves as all zeros, and that must not wipe a project's budget or
  -- delete its phases. A genuinely empty plan is cleared from the project form instead.
  IF v_total <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.projects SET budget = v_total WHERE id = p_project_id;

  SELECT count(*) INTO v_phase_count FROM public.tic_phase_totals(v_line_items);

  IF v_phase_count = 0 THEN
    -- Unphased TIC. A project with no phase gets one, so the plan has somewhere to live; an
    -- existing phase keeps its name and its contracts. The split itself — the whole plan on a
    -- single phase, NULL across several — is apply_unphased_tic_budget's, which the phase
    -- trigger also runs whenever a phase is added or removed later.
    IF NOT EXISTS (SELECT 1 FROM public.project_phases WHERE project_id = p_project_id) THEN
      INSERT INTO public.project_phases (project_id, phase_number, phase_name, budget_allocated, status)
      VALUES (p_project_id, 1, 'Faza 1', v_total, 'planning');
    END IF;
    PERFORM public.apply_unphased_tic_budget(p_project_id);
    RETURN;
  END IF;

  -- Phased TIC: it defines the phases.
  FOR v_rec IN SELECT * FROM public.tic_phase_totals(v_line_items) ORDER BY phase_number LOOP
    UPDATE public.project_phases
       SET budget_allocated = v_rec.amount
     WHERE project_id = p_project_id AND phase_number = v_rec.phase_number;

    IF NOT FOUND THEN
      INSERT INTO public.project_phases (project_id, phase_number, phase_name, budget_allocated, status)
      VALUES (p_project_id, v_rec.phase_number, 'Faza ' || v_rec.phase_number, v_rec.amount, 'planning');
    END IF;
  END LOOP;

  -- Surplus phases: remove the empty ones, keep any that work hangs off. Contracts and work
  -- logs reference phases with ON DELETE SET NULL, so deleting one with dependants would
  -- silently detach them — the same trap the phase-delete guard exists to prevent.
  FOR v_rec IN
    SELECT ph.id, ph.phase_number, ph.phase_name
      FROM public.project_phases ph
     WHERE ph.project_id = p_project_id
       AND ph.phase_number > v_phase_count
  LOOP
    IF EXISTS (SELECT 1 FROM public.contracts WHERE phase_id = v_rec.id)
       OR EXISTS (SELECT 1 FROM public.work_logs WHERE phase_id = v_rec.id) THEN
      UPDATE public.project_phases SET budget_allocated = 0 WHERE id = v_rec.id;
      RAISE NOTICE 'sync_project_from_tic: kept phase % ("%") — it has contracts or work logs '
                   'but the TIC no longer plans it; its budget is now 0',
                   v_rec.phase_number, v_rec.phase_name;
    ELSE
      DELETE FROM public.project_phases WHERE id = v_rec.id;
    END IF;
  END LOOP;

  -- A phase the TIC does not name, left NULL by an earlier unphased TIC, is planned at nothing
  -- now that the plan is phased.
  UPDATE public.project_phases SET budget_allocated = 0
   WHERE project_id = p_project_id AND budget_allocated IS NULL;

  -- Per (phase, classification). Replaced wholesale rather than merged: the TIC is the only
  -- author, so anything not in it no longer exists.
  DELETE FROM public.phase_classification_budgets b
   USING public.project_phases ph
   WHERE b.phase_id = ph.id AND ph.project_id = p_project_id;

  INSERT INTO public.phase_classification_budgets (phase_id, classification_id, budget_allocated)
  SELECT ph.id,
         (li->>'classification_id')::integer,
         SUM((p->>'vlastita')::numeric + (p->>'kreditna')::numeric)
    FROM jsonb_array_elements(v_line_items) li
    JOIN LATERAL jsonb_array_elements(COALESCE(li->'phases', '[]'::jsonb)) p ON true
    JOIN public.project_phases ph
      ON ph.project_id = p_project_id
     AND ph.phase_number = (p->>'phase_number')::integer
   WHERE li->>'classification_id' IS NOT NULL
   GROUP BY ph.id, (li->>'classification_id')::integer
  HAVING SUM((p->>'vlastita')::numeric + (p->>'kreditna')::numeric) > 0;
END $$;

COMMENT ON FUNCTION public.sync_project_from_tic(uuid) IS
  'Derives projects.budget, project_phases and phase_classification_budgets from a project''s '
  'TIC. The TIC is the only writer of planned budget. Skips an all-zero TIC so an accidental '
  'save of an untouched template cannot wipe a project, and never deletes a phase that has '
  'contracts or work logs. An unphased TIC is split by apply_unphased_tic_budget.';

REVOKE ALL ON FUNCTION public.sync_project_from_tic(uuid) FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Re-apply the unphased split when the phases change
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reapply_unphased_tic_on_phase_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- The function only updates budget_allocated, which this trigger does not listen to, so it
  -- cannot re-enter itself.
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
    PERFORM public.apply_unphased_tic_budget(OLD.project_id);
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
    PERFORM public.apply_unphased_tic_budget(NEW.project_id);
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.reapply_unphased_tic_on_phase_change() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_project_phases_unphased_tic ON public.project_phases;
CREATE TRIGGER trg_project_phases_unphased_tic
  AFTER INSERT OR DELETE OR UPDATE OF project_id ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.reapply_unphased_tic_on_phase_change();

COMMENT ON COLUMN public.project_phases.budget_allocated IS
  'This phase''s share of the TIC. NULL: the TIC is not split by phase and the project has several '
  'phases, so the project budget covers them together. 0: the TIC plans nothing for this phase, '
  'or the project has no TIC. Written only by sync_project_from_tic / apply_unphased_tic_budget.';

-- ---------------------------------------------------------------------------
-- 4. Backfill
-- ---------------------------------------------------------------------------

DO $backfill$
DECLARE
  r record;
  v_unsplit integer;
BEGIN
  FOR r IN SELECT project_id FROM public.tic_cost_structures WHERE project_id IS NOT NULL LOOP
    PERFORM public.sync_project_from_tic(r.project_id);
  END LOOP;

  SELECT count(DISTINCT project_id) INTO v_unsplit
    FROM public.project_phases WHERE budget_allocated IS NULL;
  RAISE NOTICE 'unphased_tic_phase_budgets: % project(s) now have phases not split by the TIC', v_unsplit;
END $backfill$;
