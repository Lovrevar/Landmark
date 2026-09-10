-- Folds today's classification-shaped project_phases rows into the model created by
-- 20260908120000: one real phase per project, with the cost buckets moved onto
-- contracts.classification_id and phase_classification_budgets.
--
-- Snapshot -> mutate -> assert -> abort. The whole file is one transaction, so a failed
-- assertion rolls the entire fold back. Snapshots live in the `deprecated` schema, which is
-- already revoked from anon/authenticated (see 20260518110000), so they are off the PostgREST
-- surface and need no RLS of their own.
--
-- Shape of the data this was written against (production, verified):
--   39 project_phases rows across 10 projects (an 11th, Srebrenjak, has none)
--   37 rows normalise to one of the seven canonical classifications
--    2 rows are real phase names and are preserved as such:
--        Samobor "Foundation Phase" (5 contracts), Tar "Retroaktivno" (32 contracts)
--   145 contracts, all with a non-null phase_id; 1 work_log; 4 phase document_associations
--   no project has two rows normalising to the same classification (the ON CONFLICT in
--   step 4 therefore never fires today, but is written correctly regardless)
--
-- Assertions are expressed RELATIVE TO THE SNAPSHOTS, never as hardcoded literals, so a phase
-- added between writing this and running it does not abort the migration for the wrong reason.

DO $mig$
DECLARE
  v_rec               record;
  v_pre_projects      integer;
  v_pre_contracts     integer;
  v_pre_null_phase    integer;
  v_pre_worklogs      integer;
  v_pre_docassoc      integer;
  v_unmapped          integer;
BEGIN

IF to_regclass('deprecated.phase_classification_migration_audit') IS NOT NULL THEN
  RAISE NOTICE 'phase/classification split already applied -- skipping';
  RETURN;
END IF;

-- ------------------------------------------------------------------------ snapshots

CREATE TABLE deprecated.project_phases_pre_split AS
  SELECT ph.*, now() AS snapshot_at FROM public.project_phases ph;

CREATE TABLE deprecated.contracts_phase_pre_split AS
  SELECT id, project_id, phase_id, contract_type_id FROM public.contracts;

CREATE TABLE deprecated.work_logs_phase_pre_split AS
  SELECT id, phase_id FROM public.work_logs WHERE phase_id IS NOT NULL;

CREATE TABLE deprecated.document_associations_phase_pre_split AS
  SELECT id, document_id, entity_id FROM public.document_associations WHERE entity_type = 'phase';

SELECT count(DISTINCT project_id) INTO v_pre_projects  FROM deprecated.project_phases_pre_split;
SELECT count(*)                   INTO v_pre_contracts FROM deprecated.contracts_phase_pre_split;
SELECT count(*) INTO v_pre_null_phase FROM deprecated.contracts_phase_pre_split WHERE phase_id IS NULL;
SELECT count(*) INTO v_pre_worklogs   FROM deprecated.work_logs_phase_pre_split;
SELECT count(*) INTO v_pre_docassoc   FROM deprecated.document_associations_phase_pre_split;

-- --------------------------------------------------------------- normalisation map
--
-- Matched on lower(btrim(phase_name)): four production rows carry stray leading/trailing
-- spaces (" Kontrola", " Izgradnja i uređenje", "Izgradnja " twice) and would otherwise each
-- become their own bucket. lower() absorbs the casing drift ("Priprema i Razvoj",
-- "Nepredviđeni Troškovi").
--
-- Deliberately NOT unaccent(): the extension may not be installed, and enumerating the exact
-- observed spellings is auditable in a way a fuzzy match is not. Anything not listed is treated
-- as a REAL PHASE NAME and left alone -- the migration never guesses.

CREATE TEMP TABLE phase_map ON COMMIT DROP AS
WITH normalised AS (
  SELECT ph.id           AS phase_id,
         ph.project_id,
         ph.phase_number,
         ph.phase_name,
         ph.budget_allocated,
         ph.start_date,
         ph.end_date,
         CASE lower(btrim(ph.phase_name))
           WHEN 'priprema i razvoj'     THEN 'priprema_i_razvoj'
           WHEN 'zemljište'             THEN 'zemljiste'
           WHEN 'kupoprodaja zemljišta' THEN 'zemljiste'
           WHEN 'izgradnja i uređenje'  THEN 'izgradnja_i_uredenje'
           WHEN 'izgradnja'             THEN 'izgradnja_i_uredenje'
           WHEN 'opremanje'             THEN 'opremanje'
           WHEN 'kontrola'              THEN 'kontrola'
           WHEN 'financiranje i nadzor' THEN 'financiranje_i_nadzor'
           WHEN 'nadzor i financiranje' THEN 'financiranje_i_nadzor'
           WHEN 'nepredviđeni troškovi' THEN 'nepredvideni_troskovi'
           ELSE NULL
         END AS code
    FROM public.project_phases ph
),
targets AS (
  SELECT n.project_id,
         -- Prefer the lowest-numbered REAL phase (so Samobor/Tar keep their names and their
         -- contracts stay unclassified); otherwise the lowest-numbered row overall, which will
         -- be renamed "Faza 1" in step 5.
         COALESCE(
           (SELECT n2.phase_id FROM normalised n2
             WHERE n2.project_id = n.project_id AND n2.code IS NULL
             ORDER BY n2.phase_number LIMIT 1),
           (SELECT n3.phase_id FROM normalised n3
             WHERE n3.project_id = n.project_id
             ORDER BY n3.phase_number LIMIT 1)
         ) AS target_phase_id,
         bool_or(n.code IS NULL) AS has_real_phase
    FROM normalised n
   GROUP BY n.project_id
)
SELECT n.*,
       t.target_phase_id,
       t.has_real_phase,
       cc.id AS classification_id
  FROM normalised n
  JOIN targets t USING (project_id)
  LEFT JOIN public.cost_classifications cc ON cc.code = n.code;

-- Every mapped row must have resolved to a seeded classification. If 20260908120000 did not
-- run, or a code was mistyped, stop now rather than silently leaving contracts unclassified.
IF EXISTS (SELECT 1 FROM phase_map WHERE code IS NOT NULL AND classification_id IS NULL) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: a normalised code has no matching cost_classifications row';
END IF;

SELECT count(*) INTO v_unmapped FROM phase_map WHERE code IS NULL;
RAISE NOTICE 'phase fold: % rows map to a classification, % are real phase names',
  (SELECT count(*) FROM phase_map WHERE code IS NOT NULL), v_unmapped;

FOR v_rec IN SELECT DISTINCT phase_name FROM phase_map WHERE code IS NULL ORDER BY 1 LOOP
  RAISE NOTICE '  kept as a real phase name: %', v_rec.phase_name;
END LOOP;

-- A project holding BOTH real phases and classification rows does not exist today. The rule
-- above is total, but announce it if it ever fires so it cannot happen silently.
FOR v_rec IN
  SELECT p.name FROM public.projects p
   WHERE EXISTS (SELECT 1 FROM phase_map m WHERE m.project_id = p.id AND m.code IS NULL)
     AND EXISTS (SELECT 1 FROM phase_map m WHERE m.project_id = p.id AND m.code IS NOT NULL)
LOOP
  RAISE NOTICE 'MIXED PROJECT: % has both real phases and classification rows; classification '
               'rows fold into its first real phase', v_rec.name;
END LOOP;

-- ------------------------------------------------------- 1. classify + repoint contracts

UPDATE public.contracts c
   SET classification_id = m.classification_id,
       phase_id          = m.target_phase_id
  FROM phase_map m
 WHERE c.phase_id = m.phase_id
   AND m.code IS NOT NULL;

-- ------------------------------------------------------------- 2. repoint work_logs

UPDATE public.work_logs w
   SET phase_id = m.target_phase_id
  FROM phase_map m
 WHERE w.phase_id = m.phase_id
   AND m.code IS NOT NULL;

-- ------------------------------------------------- 3. repoint document_associations
--
-- document_associations.entity_id is a bare uuid with NO foreign key (baseline :3291-3297), so
-- deleting the folded phase rows would silently orphan these instead of failing loudly. It also
-- carries UNIQUE (document_id, entity_type, entity_id), so two folded phases holding the same
-- document would collide on repoint -- move what can move, then drop the would-be duplicates.

UPDATE public.document_associations da
   SET entity_id = m.target_phase_id
  FROM phase_map m
 WHERE da.entity_type = 'phase'
   AND da.entity_id   = m.phase_id
   AND m.code IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.document_associations d2
                    WHERE d2.document_id = da.document_id
                      AND d2.entity_type = 'phase'
                      AND d2.entity_id   = m.target_phase_id);

DELETE FROM public.document_associations da
 USING phase_map m
 WHERE da.entity_type = 'phase'
   AND da.entity_id   = m.phase_id
   AND m.code IS NOT NULL
   AND da.entity_id  <> m.target_phase_id;

-- ------------------------------------------------ 4. classification sub-allocations
--
-- Each folded row's budget becomes a phase_classification_budgets row, preserving the
-- per-bucket detail that is the whole reason for the new table (Funtana's 3.8M/7.7M/812k/191k/901k
-- is a deliberate breakdown, not an even split).

INSERT INTO public.phase_classification_budgets (phase_id, classification_id, budget_allocated)
SELECT m.target_phase_id, m.classification_id, SUM(m.budget_allocated)
  FROM phase_map m
 WHERE m.code IS NOT NULL
 GROUP BY m.target_phase_id, m.classification_id
ON CONFLICT (phase_id, classification_id)
DO UPDATE SET budget_allocated = phase_classification_budgets.budget_allocated
                               + EXCLUDED.budget_allocated;

-- ------------------------------------- 5. survivor budget, dates and name
--
-- Budget is the SUM over ALL classification rows of the project, the survivor's own INCLUDED --
-- in the all-classification case the survivor is itself one of the folded rows, and forgetting
-- that is the one easy off-by-one here.
--
-- Dates span the folded windows (MIN start, MAX end). Not cosmetic: evm.ts skips PV/EV/AC when
-- either date is null, which silently forces CPI = SPI = 1 and makes Budget Control report every
-- project as perfectly on track. Only 7 rows carry dates today (Nin-retail and TEST, as genuine
-- sequential windows) but the merged phase must span them.

UPDATE public.project_phases ph
   SET budget_allocated = CASE WHEN s.has_real_phase
                               -- mixed project: the survivor is a real phase whose own budget is
                               -- NOT part of s.total, so add rather than overwrite
                               THEN ph.budget_allocated + s.total
                               ELSE s.total
                          END,
       start_date       = LEAST   (ph.start_date, s.min_start),
       end_date         = GREATEST(ph.end_date,   s.max_end),
       phase_name       = CASE WHEN NOT s.has_real_phase THEN 'Faza 1' ELSE ph.phase_name END
  FROM (SELECT target_phase_id,
               has_real_phase,
               SUM(budget_allocated) AS total,
               MIN(start_date)       AS min_start,
               MAX(end_date)         AS max_end
          FROM phase_map
         WHERE code IS NOT NULL
         GROUP BY target_phase_id, has_real_phase) s
 WHERE ph.id = s.target_phase_id;

-- ------------------------------------------- 6. drop folded rows, THEN renumber
--
-- Deleting before renumbering means the (project_id, phase_number) unique constraint can never
-- collide, independently of the deferrable change in 20260908120100.

DELETE FROM public.project_phases ph
 USING phase_map m
 WHERE ph.id = m.phase_id
   AND m.code IS NOT NULL
   AND m.phase_id <> m.target_phase_id;

UPDATE public.project_phases ph
   SET phase_number = r.rn
  FROM (SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY phase_number) AS rn
          FROM public.project_phases) r
 WHERE ph.id = r.id
   AND ph.phase_number IS DISTINCT FROM r.rn;

-- budget_used is derived, and the steps above rewrote budget_allocated without touching it.
-- A stale budget_used is exactly what makes the phase-delete guard fail open.
PERFORM public.recalculate_all_phase_budgets();

-- ----------------------------------------------------------------------- audit table

CREATE TABLE deprecated.phase_classification_migration_audit AS
SELECT pr.id   AS project_id,
       pr.name AS project_name,
       (SELECT count(*) FROM deprecated.project_phases_pre_split s WHERE s.project_id = pr.id) AS old_phase_count,
       (SELECT count(*) FROM public.project_phases ph            WHERE ph.project_id = pr.id) AS new_phase_count,
       (SELECT COALESCE(sum(s.budget_allocated), 0) FROM deprecated.project_phases_pre_split s WHERE s.project_id = pr.id) AS old_budget_sum,
       (SELECT COALESCE(sum(ph.budget_allocated), 0) FROM public.project_phases ph           WHERE ph.project_id = pr.id) AS new_budget_sum,
       pr.budget AS projects_budget,
       (SELECT count(*) FROM public.contracts c WHERE c.project_id = pr.id AND c.classification_id IS NULL) AS unclassified_contracts,
       now() AS migrated_at
  FROM public.projects pr
 WHERE EXISTS (SELECT 1 FROM deprecated.project_phases_pre_split s WHERE s.project_id = pr.id);

-- ---------------------------------------------------------------------- assertions

IF (SELECT count(*) FROM public.project_phases) <> v_pre_projects THEN
  RAISE EXCEPTION 'MIGRATION ABORT: expected one surviving phase per project (%), got %',
    v_pre_projects, (SELECT count(*) FROM public.project_phases);
END IF;

IF (SELECT count(*) FROM public.contracts) <> v_pre_contracts THEN
  RAISE EXCEPTION 'MIGRATION ABORT: contract count changed (% -> %)',
    v_pre_contracts, (SELECT count(*) FROM public.contracts);
END IF;

IF (SELECT count(*) FROM public.contracts WHERE phase_id IS NULL) <> v_pre_null_phase THEN
  RAISE EXCEPTION 'MIGRATION ABORT: a contract lost its phase_id (% -> %)',
    v_pre_null_phase, (SELECT count(*) FROM public.contracts WHERE phase_id IS NULL);
END IF;

IF (SELECT count(*) FROM public.work_logs WHERE phase_id IS NOT NULL) <> v_pre_worklogs THEN
  RAISE EXCEPTION 'MIGRATION ABORT: a work_log lost its phase_id';
END IF;

-- Every contract that sat on a classification-shaped phase must now be classified.
IF EXISTS (
  SELECT 1 FROM public.contracts c
    JOIN deprecated.contracts_phase_pre_split pre ON pre.id = c.id
    JOIN deprecated.project_phases_pre_split  old ON old.id = pre.phase_id
   WHERE c.classification_id IS NULL
     AND old.phase_name NOT IN (SELECT DISTINCT phase_name FROM phase_map WHERE code IS NULL)
) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: a contract on a classification-shaped phase is unclassified';
END IF;

IF EXISTS (SELECT 1 FROM deprecated.phase_classification_migration_audit
            WHERE old_budget_sum <> new_budget_sum) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: phase budget total not preserved for some project';
END IF;

-- Sub-allocations must never exceed the phase budget. Equality holds for a fully folded
-- project; a mixed project legitimately keeps its real phase's own budget as an unallocated
-- remainder, so this is >= rather than =. Money conservation is already asserted per project
-- against the snapshot above.
IF EXISTS (
  SELECT 1 FROM public.project_phases ph
   WHERE ph.budget_allocated < (SELECT COALESCE(sum(b.budget_allocated), 0)
                                  FROM public.phase_classification_budgets b
                                 WHERE b.phase_id = ph.id)
) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: classification sub-allocations exceed the phase budget';
END IF;

IF EXISTS (SELECT 1 FROM public.work_logs w
            WHERE w.phase_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM public.project_phases ph WHERE ph.id = w.phase_id)) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: dangling work_logs.phase_id';
END IF;

IF EXISTS (SELECT 1 FROM public.document_associations da
            WHERE da.entity_type = 'phase'
              AND NOT EXISTS (SELECT 1 FROM public.project_phases ph WHERE ph.id = da.entity_id)) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: dangling document_associations phase reference';
END IF;

IF EXISTS (SELECT 1 FROM public.project_phases
            GROUP BY project_id
           HAVING max(phase_number) <> count(*) OR min(phase_number) <> 1) THEN
  RAISE EXCEPTION 'MIGRATION ABORT: phase numbering is not contiguous from 1';
END IF;

-- --------------------------------------------------- operator review worklist
--
-- Not an error. Most projects had the SAME number typed into every phase row, so the summed
-- phase budget is meaningful for some projects and junk for others (Precko Zapad: 6 x 100M).
-- Summing is lossless and reversible; capping would bake an opinion about the user's numbers
-- irreversibly into a schema change. Surface the mismatch instead and let them fix the data.

FOR v_rec IN SELECT * FROM deprecated.phase_classification_migration_audit
              WHERE projects_budget > 0
                AND abs(new_budget_sum - projects_budget) / projects_budget > 0.01
              ORDER BY abs(new_budget_sum - projects_budget) DESC
LOOP
  RAISE NOTICE 'REVIEW: % -- phase budget % vs project budget % (delta %)',
    v_rec.project_name, v_rec.new_budget_sum, v_rec.projects_budget,
    v_rec.new_budget_sum - v_rec.projects_budget;
END LOOP;

RAISE NOTICE 'phase fold complete: % phases across % projects, % contracts (% unclassified), % budget rows',
  (SELECT count(*) FROM public.project_phases),
  v_pre_projects,
  (SELECT count(*) FROM public.contracts),
  (SELECT count(*) FROM public.contracts WHERE classification_id IS NULL),
  (SELECT count(*) FROM public.phase_classification_budgets);

END $mig$;


-- ============================================================================ ROLLBACK
--
-- Rehearse this on a restored copy BEFORE running the migration on production.
-- Restores the pre-fold state exactly; the new columns/tables from 20260908120000 survive but
-- end up empty, which is harmless.
--
-- BEGIN;
--   DELETE FROM public.phase_classification_budgets;
--   UPDATE public.contracts SET classification_id = NULL;
--
--   DELETE FROM public.project_phases;
--   INSERT INTO public.project_phases
--     (id, project_id, phase_number, phase_name, budget_allocated, budget_used,
--      start_date, end_date, status, created_at)
--   SELECT id, project_id, phase_number, phase_name, budget_allocated, budget_used,
--          start_date, end_date, status, created_at
--     FROM deprecated.project_phases_pre_split;
--
--   UPDATE public.contracts c SET phase_id = pre.phase_id
--     FROM deprecated.contracts_phase_pre_split pre WHERE pre.id = c.id;
--   UPDATE public.work_logs w SET phase_id = pre.phase_id
--     FROM deprecated.work_logs_phase_pre_split pre WHERE pre.id = w.id;
--   UPDATE public.document_associations da SET entity_id = pre.entity_id
--     FROM deprecated.document_associations_phase_pre_split pre WHERE pre.id = da.id;
--
--   SELECT public.recalculate_all_phase_budgets();
--
--   DROP TABLE deprecated.phase_classification_migration_audit;
--   DROP TABLE deprecated.project_phases_pre_split;
--   DROP TABLE deprecated.contracts_phase_pre_split;
--   DROP TABLE deprecated.work_logs_phase_pre_split;
--   DROP TABLE deprecated.document_associations_phase_pre_split;
-- COMMIT;
