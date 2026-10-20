/*
  # One unit number per building, one building name per project (SALES-9, SALES-17)

  Nothing stopped two apartments, garages or storage units in a building from carrying the same
  number, or two buildings in a project the same name. Bulk create run twice duplicated a whole
  range; a garage import with a number repeated in the file inserted it twice; and the apartment
  import finds its building by name, so a duplicated name made it pick one of the two without
  saying which.

  Compared case-insensitively and trimmed: "A-101", "a-101" and " A-101 " are one number to a
  person reading a sales contract.

  - apartments:   (project_id, building_id, number). `building_id` is nullable, and NULLs are
                  distinct in a unique index, so an apartment without a building is compared
                  within its project through a fixed placeholder id.
  - garages:      (building_id, number)
  - repositories: (building_id, number)
  - buildings:    (project_id, name)

  No database had a duplicate on 2026-10-12. If one has appeared since, the block below stops the
  migration and names it, instead of failing on the index with a message about a constraint.
*/

DO $$
DECLARE
  v_duplicates text;
BEGIN
  SELECT string_agg(found.what, '; ') INTO v_duplicates
  FROM (
    SELECT 'apartment "' || min(number) || '" x' || count(*) || ' (project ' || project_id || ')' AS what
    FROM public.apartments
    GROUP BY project_id, building_id, lower(btrim(number)) HAVING count(*) > 1
    UNION ALL
    SELECT 'garage "' || min(number) || '" x' || count(*) || ' (building ' || building_id || ')'
    FROM public.garages
    GROUP BY building_id, lower(btrim(number)) HAVING count(*) > 1
    UNION ALL
    SELECT 'storage unit "' || min(number) || '" x' || count(*) || ' (building ' || building_id || ')'
    FROM public.repositories
    GROUP BY building_id, lower(btrim(number)) HAVING count(*) > 1
    UNION ALL
    SELECT 'building "' || min(name) || '" x' || count(*) || ' (project ' || project_id || ')'
    FROM public.buildings
    GROUP BY project_id, lower(btrim(name)) HAVING count(*) > 1
  ) found;

  IF v_duplicates IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicates must be renamed or removed before unit numbers can be made unique: %', v_duplicates;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS apartments_unique_number_per_building
  ON public.apartments (project_id, COALESCE(building_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(number)));

CREATE UNIQUE INDEX IF NOT EXISTS garages_unique_number_per_building
  ON public.garages (building_id, lower(btrim(number)));

CREATE UNIQUE INDEX IF NOT EXISTS repositories_unique_number_per_building
  ON public.repositories (building_id, lower(btrim(number)));

CREATE UNIQUE INDEX IF NOT EXISTS buildings_unique_name_per_project
  ON public.buildings (project_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Manual check after applying (read-only):
--
--   SELECT indexname FROM pg_indexes
--   WHERE indexname LIKE '%unique_number_per_building' OR indexname = 'buildings_unique_name_per_project';
--   -- expect four rows
-- ---------------------------------------------------------------------------
