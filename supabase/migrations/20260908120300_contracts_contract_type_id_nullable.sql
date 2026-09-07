-- Removes an unusable default that has been a latent FK violation since contract_types was
-- introduced.
--
-- contracts.contract_type_id is `integer NOT NULL DEFAULT 0` with an FK to contract_types(id),
-- but there is NO contract_types row with id = 0 -- verified in production, where the table
-- holds only ids 1..4 (Javni bilježnici, Zemljište, Razno, Rušenje). So any insert that omits
-- the column, or passes the `data.contract_type_id || 0` fallback with a falsy value, raises a
-- raw 23503 that surfaces to the user untranslated. It stays hidden today only because the
-- subcontractor form validates the field before submitting.
--
-- Fixed by matching the new contracts.classification_id -- nullable, no default, NULL meaning
-- "uncategorised" -- rather than by inventing a sentinel id = 0 row. The UI already renders a
-- missing contract type as "Nekategorizirano".
--
-- contract_types itself is UNCHANGED: it remains the third grouping axis beneath the new cost
-- classification.

ALTER TABLE public.contracts ALTER COLUMN contract_type_id DROP DEFAULT;
ALTER TABLE public.contracts ALTER COLUMN contract_type_id DROP NOT NULL;

-- Expected to affect 0 rows in production; present so the column is consistent wherever this
-- migration is applied to a database that did manage to store a 0.
UPDATE public.contracts SET contract_type_id = NULL WHERE contract_type_id = 0;

COMMENT ON COLUMN public.contracts.contract_type_id IS
  'Contract/vendor kind (Razno, Rušenje, ...). Orthogonal to classification_id. '
  'NULL means uncategorised.';
