/*
  # Documents storage bucket + atomic association replacement RPC

  Companion to 20260429090744_create_unified_document_management.sql.
  - Creates the generic `documents` storage bucket the new service uploads into.
  - Adds storage RLS for that bucket, mirroring the contract-documents pattern.
  - Adds `replace_document_associations(uuid, jsonb)` so updateDocument() can
    swap an entire association set in a single transaction.
*/

-- 1. Storage bucket — 50MB cap, all mime types (real-estate dev docs include
--    CAD/BIM exports that comfortably exceed the 25MB used elsewhere).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS — same shape as contract-documents.
DROP POLICY IF EXISTS "Authenticated users can upload to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents bucket"      ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from documents bucket" ON storage.objects;

CREATE POLICY "Authenticated users can upload to documents bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can read documents bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete from documents bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

-- 3. Atomic association replacement.
CREATE OR REPLACE FUNCTION public.replace_document_associations(
  p_document_id uuid,
  p_associations jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  DELETE FROM document_associations WHERE document_id = p_document_id;

  IF p_associations IS NOT NULL AND jsonb_array_length(p_associations) > 0 THEN
    INSERT INTO document_associations (document_id, entity_type, entity_id)
    SELECT p_document_id,
           a->>'entityType',
           (a->>'entityId')::uuid
    FROM jsonb_array_elements(p_associations) a;
  END IF;
END;
$$;
