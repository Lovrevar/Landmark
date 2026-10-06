/*
  # Seed the IZVODACI document category

  DEFECT_BACKLOG SUP-10. `uploadSubcontractorDocuments` (Supervision → Site Management) files every
  contract document under the category with code `IZVODACI` and throws when it is missing. The
  baseline is schema-only, so a fresh environment has no such row and every contract upload fails
  until someone adds it by hand (the demo seed script creates `UGOVORI_PODIZVODACI`, not this).

  Inserted as a root category and only when the code is free: an environment that already has
  IZVODACI (production) keeps its row, name and place in the tree untouched.
*/

INSERT INTO public.document_categories (code, name_hr, parent_id, path, display_order, required_associations, is_active)
VALUES ('IZVODACI', 'Izvođači', NULL, 'IZVODACI', 99, '["subcontractor"]'::jsonb, true)
ON CONFLICT (code) DO NOTHING;
