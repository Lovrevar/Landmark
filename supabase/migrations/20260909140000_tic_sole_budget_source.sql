-- Makes the TIC the ONLY writer of planned budget, and lets a TIC carry phases.
--
-- 20260909130000 made the TIC *a* source: it synced projects.budget. Budgets could still be
-- typed by hand in three other places, and a TIC described one undifferentiated project.
-- 1908_TIC_Osijek.xlsx shows a TIC that is itself phased — FAZA 1/2/3 as column groups — so the
-- plan can now say not just how much, but when.
--
-- After this, everything planned derives from one place:
--   projects.budget                  <- TIC grand total
--   project_phases                   <- the TIC's phases define them
--   project_phases.budget_allocated  <- that phase's share of the plan
--   phase_classification_budgets     <- the (phase x classification) grouping
--
-- Only the INVESTICIJA rows feed budgets. GRAĐENJE is a breakdown of the single "Građenje"
-- line — in both real workbooks its SVEUKUPNO equals that line exactly — so counting it too
-- would double the largest item in the plan.

-- A line item carries `phases: [{phase_number, vlastita, kreditna}]` when its cost is spread,
-- and omits it when the cost is incurred once for the whole project. That distinction is not
-- cosmetic: in the Osijek file "Vrijednost zemljišta" shows its full 4.000.000 against each of
-- three phases, and summing those columns would invent 8.000.000 of budget.
CREATE OR REPLACE FUNCTION public.tic_phase_totals(p_line_items jsonb)
RETURNS TABLE (phase_number integer, amount numeric)
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT (ph->>'phase_number')::integer,
         SUM((ph->>'vlastita')::numeric + (ph->>'kreditna')::numeric)
    FROM jsonb_array_elements(p_line_items) li,
         jsonb_array_elements(COALESCE(li->'phases', '[]'::jsonb)) ph
   GROUP BY 1
$$;

CREATE OR REPLACE FUNCTION public.sync_project_from_tic(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_line_items jsonb;
  v_total      numeric;
  v_phase_count integer;
  v_rec        record;
  v_phase_id   uuid;
  v_kept       integer := 0;
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
    -- Unphased TIC: one phase holds the whole plan. Create it only if the project has none,
    -- so an existing phase keeps its name and its contracts.
    IF NOT EXISTS (SELECT 1 FROM public.project_phases WHERE project_id = p_project_id) THEN
      INSERT INTO public.project_phases (project_id, phase_number, phase_name, budget_allocated, status)
      VALUES (p_project_id, 1, 'Faza 1', v_total, 'planning');
    ELSE
      UPDATE public.project_phases SET budget_allocated = v_total
       WHERE project_id = p_project_id AND phase_number = 1;
      -- Phases beyond the first get nothing: the plan does not distinguish them.
      UPDATE public.project_phases SET budget_allocated = 0
       WHERE project_id = p_project_id AND phase_number > 1;
    END IF;
  ELSE
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
        v_kept := v_kept + 1;
        RAISE NOTICE 'sync_project_from_tic: kept phase % ("%") — it has contracts or work logs '
                     'but the TIC no longer plans it; its budget is now 0',
                     v_rec.phase_number, v_rec.phase_name;
      ELSE
        DELETE FROM public.project_phases WHERE id = v_rec.id;
      END IF;
    END LOOP;
  END IF;

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

  -- Unphased TIC: the classification split still belongs to the single phase.
  IF v_phase_count = 0 THEN
    INSERT INTO public.phase_classification_budgets (phase_id, classification_id, budget_allocated)
    SELECT ph.id, (li->>'classification_id')::integer,
           SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric)
      FROM jsonb_array_elements(v_line_items) li
      JOIN public.project_phases ph
        ON ph.project_id = p_project_id AND ph.phase_number = 1
     WHERE li->>'classification_id' IS NOT NULL
     GROUP BY ph.id, (li->>'classification_id')::integer
    HAVING SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric) > 0
    ON CONFLICT (phase_id, classification_id) DO UPDATE
      SET budget_allocated = EXCLUDED.budget_allocated;
  END IF;
END $$;

COMMENT ON FUNCTION public.sync_project_from_tic(uuid) IS
  'Derives projects.budget, project_phases and phase_classification_budgets from a project''s '
  'TIC. The TIC is the only writer of planned budget. Skips an all-zero TIC so an accidental '
  'save of an untouched template cannot wipe a project, and never deletes a phase that has '
  'contracts or work logs.';

-- Replaces the budget-only trigger from 20260909130000.
CREATE OR REPLACE FUNCTION public.sync_project_budget_from_tic()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    PERFORM public.sync_project_from_tic(NEW.project_id);
  END IF;
  RETURN NEW;
END $$;

-- Backfill every project that already has a real TIC.
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN SELECT project_id FROM public.tic_cost_structures WHERE project_id IS NOT NULL LOOP
    PERFORM public.sync_project_from_tic(r.project_id);
  END LOOP;
END $backfill$;
