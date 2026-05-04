/*
  Default `required_associations` to ["project"] for the entire taxonomy,
  except the FINANCIJE branch — corporate / holding-level financial documents
  aren't always tied to a single project, so they stay optional.
  IZGRADNJA/IZVOĐAČI keeps its existing subcontractor requirement on top of project.

  Idempotent — re-running just re-applies the same values.
*/

-- 1. Project required for every category outside the FINANCIJE branch.
UPDATE document_categories
SET required_associations = '["project"]'::jsonb
WHERE path <> 'FINANCIJE'
  AND path NOT LIKE 'FINANCIJE/%';

-- 2. IZGRADNJA/IZVOĐAČI also requires a subcontractor.
UPDATE document_categories
SET required_associations = '["project", "subcontractor"]'::jsonb
WHERE code = 'IZVODACI';

-- 3. FINANCIJE branch stays optional (explicit reset for clarity / idempotency).
UPDATE document_categories
SET required_associations = '[]'::jsonb
WHERE path = 'FINANCIJE'
   OR path LIKE 'FINANCIJE/%';
