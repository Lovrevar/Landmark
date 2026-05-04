/*
  KUPOPRODAJNI_UGOVORI (land purchase contracts) always belong to a project.
  Update the seeded category row so the project association is required when
  filing documents under it. Idempotent — re-running just re-applies the value.
*/

UPDATE document_categories
SET required_associations = '["project"]'::jsonb
WHERE code = 'KUPOPRODAJNI_UGOVORI';
