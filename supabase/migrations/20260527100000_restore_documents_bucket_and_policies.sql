/*
  # Restore documents storage bucket + RLS policies

  Original setup lived in 20260429091500_create_documents_storage_and_rpc.sql
  but that file was neutered to a no-op during the 2026-05-15 migration
  reconciliation. pg_dump only captures the `public` schema, so the
  storage.objects policies and the bucket row were lost from the migration
  history. Environments that replay from baseline end up with the
  `documents` bucket unusable: RLS is enabled but no INSERT/SELECT/DELETE
  policies exist, so every upload returns a 403 (logged at the gateway
  as 400 with body `{"statusCode":"403","error":"Unauthorized",
  "message":"new row violates row-level security policy"}`).

  This migration is fully idempotent so it can run safely alongside
  environments where the bucket and policies still exist.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload to documents bucket"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents bucket"        ON storage.objects;
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
