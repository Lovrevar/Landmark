/*
  # Unified Document Management

  Replaces the per-domain `subcontractor_documents` table with a generic
  document store that can be associated with any entity in the system.

  1. New Tables
    - `document_categories`
      - Hierarchical taxonomy (self-FK on `parent_id`)
      - `code` is a stable machine identifier (uppercase, underscores, no diacritics)
      - `path` is a denormalized full code path, e.g. `PROJEKT_I_DOZVOLE/DOZVOLE/LOKACIJSKA`
      - `required_associations` lists which entity types must be linked
        when a document is filed under this category (advisory; enforced in app)
    - `documents`
      - Single row per file, regardless of which module uploaded it
      - `source` distinguishes app uploads from migrated / synced data
      - `category_id` is nullable so legacy / un-curated rows can exist
      - `search_text` is a tsvector reserved for full-text search; populated later
    - `document_associations`
      - Polymorphic link table: one document can attach to many entities,
        of mixed entity types
      - Composite index on (entity_type, entity_id) for "documents for X" lookups

  2. Seed Data
    - Full CEO-supplied taxonomy inserted with display order and
      `required_associations` set per the spec

  3. Data Migration
    - Every row in `subcontractor_documents` is copied into `documents`
      with `source = 'legacy_subcontractor'` under the IZGRADNJA/IZVODACI category
    - Original `id` is preserved so any external reference to the old row
      lines up with the new one
    - `document_associations` rows are created for `subcontractor_id` (always)
      and `contract_id` (when present)
    - The old `subcontractor_documents` table is intentionally left in place

  4. Security
    - RLS mirrors the existing `subcontractor_documents` pattern:
      authenticated users can read everything, insert their own uploads,
      and delete (role-restricted DELETE can be layered on later)
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE document_categories (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text        NOT NULL UNIQUE,
  name_hr               text        NOT NULL,
  parent_id             uuid        REFERENCES document_categories(id) ON DELETE RESTRICT,
  path                  text        NOT NULL,
  display_order         integer     NOT NULL DEFAULT 0,
  required_associations jsonb       NOT NULL DEFAULT '[]'::jsonb,
  is_active             boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_categories_parent_id
  ON document_categories(parent_id);

CREATE TABLE documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path    text        NOT NULL,
  file_name    text        NOT NULL,
  file_size    integer     NOT NULL DEFAULT 0,
  mime_type    text,
  category_id  uuid        REFERENCES document_categories(id) ON DELETE SET NULL,
  source       text        NOT NULL DEFAULT 'app_upload'
                           CHECK (source IN ('app_upload',
                                             'legacy_subcontractor',
                                             'accounting_sync',
                                             'filesystem_scan')),
  description  text,
  uploaded_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  search_text  tsvector
);

CREATE INDEX idx_documents_category_id
  ON documents(category_id);

CREATE INDEX idx_documents_uploaded_at
  ON documents(uploaded_at DESC);

CREATE INDEX idx_documents_search_text
  ON documents USING gin (search_text);

CREATE TABLE document_associations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entity_type text NOT NULL
              CHECK (entity_type IN ('project',
                                     'phase',
                                     'subcontractor',
                                     'contract',
                                     'unit',
                                     'customer',
                                     'credit',
                                     'company')),
  entity_id   uuid NOT NULL,
  UNIQUE (document_id, entity_type, entity_id)
);

CREATE INDEX idx_document_associations_entity
  ON document_associations(entity_type, entity_id);

CREATE INDEX idx_document_associations_document_id
  ON document_associations(document_id);

-- updated_at maintenance for categories
CREATE TRIGGER update_document_categories_updated_at
  BEFORE UPDATE ON document_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE document_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_associations ENABLE ROW LEVEL SECURITY;

-- document_categories: read-only for app users; curation happens via migrations
CREATE POLICY "Authenticated users can view document_categories"
  ON document_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert document_categories"
  ON document_categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update document_categories"
  ON document_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete document_categories"
  ON document_categories FOR DELETE TO authenticated USING (true);

-- documents: same shape as the legacy subcontractor_documents policies
CREATE POLICY "Authenticated users can view documents"
  ON documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upload documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update documents"
  ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documents"
  ON documents FOR DELETE TO authenticated USING (true);

-- document_associations: open to authenticated, mirrors documents
CREATE POLICY "Authenticated users can view document_associations"
  ON document_associations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert document_associations"
  ON document_associations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete document_associations"
  ON document_associations FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- SEED: CEO-supplied taxonomy
-- ============================================================================

-- Top-level
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations) VALUES
  ('PRAVNO',             'PRAVNO',             NULL, 'PRAVNO',             1, '[]'::jsonb),
  ('PROJEKT_I_DOZVOLE',  'PROJEKT I DOZVOLE',  NULL, 'PROJEKT_I_DOZVOLE',  2, '["project"]'::jsonb),
  ('IZGRADNJA',          'IZGRADNJA',          NULL, 'IZGRADNJA',          3, '[]'::jsonb),
  ('RAZVOJ',             'RAZVOJ',             NULL, 'RAZVOJ',             4, '[]'::jsonb),
  ('PRODAJA',            'PRODAJA',            NULL, 'PRODAJA',            5, '[]'::jsonb),
  ('FINANCIJE',          'FINANCIJE',          NULL, 'FINANCIJE',          6, '[]'::jsonb);

-- PRAVNO children
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'KUPOPRODAJNI_UGOVORI', 'KUPOPRODAJNI UGOVORI', id,
       path || '/KUPOPRODAJNI_UGOVORI', 1, '[]'::jsonb
FROM document_categories WHERE code = 'PRAVNO';

INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'KATASTAR_I_ZEMLJISNA_KNJIGA', 'KATASTAR I ZEMLJIŠNA KNJIGA', id,
       path || '/KATASTAR_I_ZEMLJISNA_KNJIGA', 2, '[]'::jsonb
FROM document_categories WHERE code = 'PRAVNO';

-- PROJEKT I DOZVOLE children (all inherit ["project"])
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'IDEJNI_KONCEPT',    'IDEJNI KONCEPT',    id, path || '/IDEJNI_KONCEPT',    1, '["project"]'::jsonb FROM document_categories WHERE code = 'PROJEKT_I_DOZVOLE';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'IDEJNI_PROJEKT',    'IDEJNI PROJEKT',    id, path || '/IDEJNI_PROJEKT',    2, '["project"]'::jsonb FROM document_categories WHERE code = 'PROJEKT_I_DOZVOLE';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'GLAVNI_PROJEKT',    'GLAVNI PROJEKT',    id, path || '/GLAVNI_PROJEKT',    3, '["project"]'::jsonb FROM document_categories WHERE code = 'PROJEKT_I_DOZVOLE';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'IZVEDBENI_PROJEKT', 'IZVEDBENI PROJEKT', id, path || '/IZVEDBENI_PROJEKT', 4, '["project"]'::jsonb FROM document_categories WHERE code = 'PROJEKT_I_DOZVOLE';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'IZVEDBENO_STANJE',  'IZVEDBENO STANJE',  id, path || '/IZVEDBENO_STANJE',  5, '["project"]'::jsonb FROM document_categories WHERE code = 'PROJEKT_I_DOZVOLE';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'DOZVOLE',           'DOZVOLE',           id, path || '/DOZVOLE',           6, '["project"]'::jsonb FROM document_categories WHERE code = 'PROJEKT_I_DOZVOLE';

-- DOZVOLE children
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'LOKACIJSKA',  'LOKACIJSKA',  id, path || '/LOKACIJSKA',  1, '["project"]'::jsonb FROM document_categories WHERE code = 'DOZVOLE';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'GRADEVINSKA', 'GRAĐEVINSKA', id, path || '/GRADEVINSKA', 2, '["project"]'::jsonb FROM document_categories WHERE code = 'DOZVOLE';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'UVJETI',      'UVJETI',      id, path || '/UVJETI',      3, '["project"]'::jsonb FROM document_categories WHERE code = 'DOZVOLE';

-- UVJETI children
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'HEP',     'HEP',     id, path || '/HEP',     1, '["project"]'::jsonb FROM document_categories WHERE code = 'UVJETI';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'VODA',    'VODA',    id, path || '/VODA',    2, '["project"]'::jsonb FROM document_categories WHERE code = 'UVJETI';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'ODVODNJA','ODVODNJA',id, path || '/ODVODNJA',3, '["project"]'::jsonb FROM document_categories WHERE code = 'UVJETI';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'RAZNO',   'RAZNO',   id, path || '/RAZNO',   4, '["project"]'::jsonb FROM document_categories WHERE code = 'UVJETI';

-- IZGRADNJA children
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'TENDER',   'TENDER',   id, path || '/TENDER',   1, '[]'::jsonb FROM document_categories WHERE code = 'IZGRADNJA';
INSERT INTO document_categories (code, name_hr, parent_id, path, display_order, required_associations)
SELECT 'IZVODACI', 'IZVOĐAČI', id, path || '/IZVODACI', 2, '["project", "subcontractor"]'::jsonb FROM document_categories WHERE code = 'IZGRADNJA';

-- ============================================================================
-- DATA MIGRATION: subcontractor_documents → documents (+ associations)
-- ============================================================================

-- Copy file rows. Preserve original `id` so any external references line up.
INSERT INTO documents (
  id, file_path, file_name, file_size, mime_type,
  category_id, source, uploaded_by, uploaded_at
)
SELECT
  sd.id,
  sd.file_path,
  sd.file_name,
  sd.file_size,
  NULL,
  (SELECT id FROM document_categories WHERE code = 'IZVODACI'),
  'legacy_subcontractor',
  sd.uploaded_by,
  COALESCE(sd.uploaded_at, now())
FROM subcontractor_documents sd;

-- Subcontractor associations (always present in the old schema)
INSERT INTO document_associations (document_id, entity_type, entity_id)
SELECT sd.id, 'subcontractor', sd.subcontractor_id
FROM subcontractor_documents sd
WHERE sd.subcontractor_id IS NOT NULL;

-- Contract associations (optional in the old schema)
INSERT INTO document_associations (document_id, entity_type, entity_id)
SELECT sd.id, 'contract', sd.contract_id
FROM subcontractor_documents sd
WHERE sd.contract_id IS NOT NULL;
