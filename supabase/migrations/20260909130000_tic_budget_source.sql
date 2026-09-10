-- Makes the TIC the source of a project's planned budget.
--
-- Until now `projects.budget` was a hand-typed number and the TIC was a document generator with
-- no connection to it. Where both existed they disagreed sharply — Mala Savska Opatovina had a
-- TIC of 2,849,270 against a typed budget of 4,500,000; Funtana 19,294,330 against 13,400,000.
--
-- Three changes:
--   1. Each investment line carries the cost classification its money belongs to, so the TIC can
--      also populate phase_classification_budgets (added in 20260908120000).
--   2. One TIC per project is enforced, which the code has always assumed but nothing checked.
--   3. Saving a non-zero TIC syncs projects.budget to its grand total.
--
-- Only the INVESTICIJA rows (`line_items`) feed budgets. The GRAĐENJE tab
-- (`construction_sections`) is a breakdown of the single "Građenje" line — in the source
-- workbook its SVEUKUPNO equals that line exactly — so counting both would double the largest
-- item in the plan. Nothing here reads construction_sections.

-- ------------------------------------------------------------------ 1. classification backfill
--
-- Mirrored in src/components/Funding/TIC/utils/ticClassificationMap.ts, which classifies rows
-- arriving from an Excel import after this has run. Keep the two in sync.
--
-- These are defaults: the mapping lives on each line item and is editable per project in the TIC
-- table, so a project that files Konzalting under preparation rather than control just changes
-- it there.

DO $mig$
DECLARE
  v_unmapped integer;
  v_dupes    integer;
BEGIN

CREATE TEMP TABLE tic_line_classification (line_name text PRIMARY KEY, code text) ON COMMIT DROP;
INSERT INTO tic_line_classification (line_name, code) VALUES
  ('vrijednost zemljišta',                      'zemljiste'),
  ('porez na promet nekretnina',                'zemljiste'),
  ('priprema projekta',                         'priprema_i_razvoj'),
  ('projektna dokumentacija, geodetske usluge', 'priprema_i_razvoj'),
  ('komunalni i vodni doprinos',                'priprema_i_razvoj'),
  ('priključci',                                'priprema_i_razvoj'),
  ('građenje',                                  'izgradnja_i_uredenje'),
  ('unutarnje uređenje',                        'izgradnja_i_uredenje'),
  ('opremanje (namještaj, bijela tehnika)',     'opremanje'),
  ('stručni nadzor',                            'kontrola'),
  ('konzalting',                                'kontrola'),
  ('uknjižba, etažiranje, uporabna dozvola',    'kontrola'),
  ('posredovanje, marketing, osiguranje',       'financiranje_i_nadzor'),
  ('financijski nadzor',                        'financiranje_i_nadzor'),
  ('financiranje',                              'financiranje_i_nadzor'),
  ('nepredviđeni troškovi',                     'nepredvideni_troskovi');

-- Every code above must resolve, or the backfill would silently leave money unclassified.
IF EXISTS (
  SELECT 1 FROM tic_line_classification m
   WHERE NOT EXISTS (SELECT 1 FROM public.cost_classifications c WHERE c.code = m.code)
) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: a mapped code has no cost_classifications row — did 20260908120000 run?';
END IF;

-- Rebuild each line_items array with classification_id attached. Matched on the trimmed,
-- lowercased name; a row whose name is not canonical keeps a null and shows in the UI as
-- unmapped rather than being guessed into a bucket.
UPDATE public.tic_cost_structures t
   SET line_items = rebuilt.items
  FROM (
    SELECT t2.id,
           COALESCE(
             jsonb_agg(
               li || jsonb_build_object('classification_id', to_jsonb(c.id))
               ORDER BY ord
             ),
             '[]'::jsonb
           ) AS items
      FROM public.tic_cost_structures t2,
           LATERAL jsonb_array_elements(t2.line_items) WITH ORDINALITY AS e(li, ord)
      LEFT JOIN tic_line_classification m ON m.line_name = lower(btrim(e.li->>'name'))
      LEFT JOIN public.cost_classifications c ON c.code = m.code
     GROUP BY t2.id
  ) rebuilt
 WHERE t.id = rebuilt.id;

SELECT count(*) INTO v_unmapped
  FROM public.tic_cost_structures t, jsonb_array_elements(t.line_items) li
 WHERE li->>'classification_id' IS NULL;

RAISE NOTICE 'TIC backfill: % line item(s) left unmapped (expected 0 for the canonical 16 rows)', v_unmapped;

-- ------------------------------------------------------------- 2. one TIC per project
--
-- fetchTICForProject uses .maybeSingle(), and saveTIC inserts whenever its in-memory ticId is
-- null — so two tabs open on one project both insert, and loading that project breaks for good
-- with PGRST116. Nothing prevented it until now.

SELECT count(*) INTO v_dupes FROM (
  SELECT project_id FROM public.tic_cost_structures
   WHERE project_id IS NOT NULL
   GROUP BY project_id HAVING count(*) > 1
) d;

IF v_dupes > 0 THEN
  RAISE EXCEPTION 'MIGRATION ABORT: % project(s) already have more than one TIC row. '
                  'Merge them by hand before applying this migration.', v_dupes;
END IF;

END $mig$;

-- Partial: project_id is nullable, and the RLS policies treat a null project_id as a
-- globally-visible template row, so those are not constrained to one.
CREATE UNIQUE INDEX IF NOT EXISTS tic_cost_structures_project_id_key
    ON public.tic_cost_structures (project_id)
 WHERE project_id IS NOT NULL;

-- --------------------------------------------------- 3. sync projects.budget from the TIC

CREATE OR REPLACE FUNCTION public.sync_project_budget_from_tic()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric), 0)
    INTO v_total
    FROM jsonb_array_elements(NEW.line_items) li;

  -- Only a TIC that says something overwrites the budget.
  --
  -- Most projects carry a TIC record whose rows are all zero — the screen shows the default
  -- template whether or not anything was ever filled in, so saving one is easy to do by
  -- accident. Without this guard that would silently set the project's budget to 0 and take
  -- EVM, funding ratios, Budget Control and every dashboard down with it. A project whose plan
  -- genuinely is zero can still have its budget cleared by hand on the project form.
  IF v_total > 0 THEN
    UPDATE public.projects SET budget = v_total WHERE id = NEW.project_id;
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.sync_project_budget_from_tic() IS
  'Keeps projects.budget equal to the TIC investment grand total. Skips all-zero TICs so an '
  'accidental save of an untouched template cannot wipe a project budget.';

DROP TRIGGER IF EXISTS trg_sync_project_budget_from_tic ON public.tic_cost_structures;

-- A trigger rather than client code so the sync cannot be missed by the Excel import path, a
-- second client, or a future caller that writes the table directly.
CREATE TRIGGER trg_sync_project_budget_from_tic
    AFTER INSERT OR UPDATE OF line_items, project_id ON public.tic_cost_structures
    FOR EACH ROW EXECUTE FUNCTION public.sync_project_budget_from_tic();

-- Bring the three projects that already have a real TIC into line, so the drift badge does not
-- flag every one of them on day one. The eight all-zero TICs are left alone by the guard above.
UPDATE public.projects p
   SET budget = src.total
  FROM (
    SELECT t.project_id,
           (SELECT COALESCE(SUM((li->>'vlastita')::numeric + (li->>'kreditna')::numeric), 0)
              FROM jsonb_array_elements(t.line_items) li) AS total
      FROM public.tic_cost_structures t
     WHERE t.project_id IS NOT NULL
  ) src
 WHERE p.id = src.project_id
   AND src.total > 0
   AND p.budget IS DISTINCT FROM src.total;
