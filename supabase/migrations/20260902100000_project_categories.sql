-- Sales asked for projects to carry an explicit category so the General project
-- form can set it and the Sales projects screen can group by it.
--
-- NOTE: 'retail' here is a *project* category on public.projects. It is unrelated
-- to the Retail module (retail_projects / retail_land_plots), which models land
-- development and is not driven by this column.

ALTER TABLE public.projects
  ADD COLUMN category text NOT NULL DEFAULT 'stambeno';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_category_check
  CHECK (category = ANY (ARRAY['interno'::text, 'retail'::text, 'stambeno'::text]));

COMMENT ON COLUMN public.projects.category IS
  'Project category: interno | retail | stambeno. Unrelated to the Retail module.';

-- Backfill the categories sales confirmed: Samobor is interno, Jaska and Nin are
-- retail, everything else keeps the 'stambeno' default.
--
-- Matched with word-boundary regex on name and location rather than LIKE '%nin%',
-- which would also hit any name merely containing those letters. "Jaska" is the
-- colloquial name for Jastrebarsko, so both spellings are matched.
UPDATE public.projects
   SET category = 'interno'
 WHERE name ~* '\msamobor' OR location ~* '\msamobor';

UPDATE public.projects
   SET category = 'retail'
 WHERE name ~* '\m(jaska|jastrebarsk)' OR location ~* '\m(jaska|jastrebarsk)'
    OR name ~* '\mnin\M'               OR location ~* '\mnin\M';

-- Surface what the backfill actually matched, so an operator applying this to a
-- database the author could not inspect can verify it against the real project list.
DO $$
DECLARE
  row_out record;
BEGIN
  FOR row_out IN
    SELECT category, name, location
      FROM public.projects
     WHERE category <> 'stambeno'
     ORDER BY category, name
  LOOP
    RAISE NOTICE 'project categorised as %: % (%)',
      row_out.category, row_out.name, row_out.location;
  END LOOP;
END $$;
