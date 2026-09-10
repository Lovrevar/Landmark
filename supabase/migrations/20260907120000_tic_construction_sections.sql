-- TIC: add the "GRAĐENJE" (construction) cost breakdown alongside the existing
-- "INVESTICIJA" line items. Hierarchical: sections (A/B/C) each holding items.
-- Section subtotals and the grand total are always derived, never stored.
ALTER TABLE public.tic_cost_structures
  ADD COLUMN IF NOT EXISTS construction_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tic_cost_structures.construction_sections IS
  'Array of { code, name, items: [{ numeral, name, vlastita, kreditna }] } — the GRAĐENJE sheet.';
