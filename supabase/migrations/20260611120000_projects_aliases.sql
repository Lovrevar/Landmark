-- Alternate names for projects, used by the sort-document classifier
-- (e.g. project "Zona 31" is referred to as "Osijek" in contracts).
ALTER TABLE public.projects
  ADD COLUMN aliases text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.projects.aliases IS
  'Alternate names used in documents/contracts; matched by the sort-document classifier.';
