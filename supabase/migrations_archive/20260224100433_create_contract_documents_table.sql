/*
  # Create Contract Documents Table and Storage Bucket

  ## Summary
  Adds infrastructure for storing PDF contract documents linked to subcontractor contracts.

  ## New Tables
  - `contract_documents`
    - `id` (uuid, primary key)
    - `contract_id` (uuid, FK to contracts - cascade delete)
    - `file_name` (text) - original file name
    - `file_path` (text) - path in Supabase Storage bucket
    - `file_size` (integer) - file size in bytes
    - `uploaded_at` (timestamptz) - upload timestamp
    - `uploaded_by` (uuid, FK to auth.users)

  ## Security
  - RLS enabled with policies for authenticated users
  - SELECT: authenticated users can view documents
  - INSERT: authenticated users can upload documents
  - DELETE: authenticated users can delete documents

  ## Storage
  - Creates a private storage bucket `contract-documents`
  - Files stored under path: contracts/{contract_id}/{filename}
  - Max file size enforced at application level (25MB per file)

  ## Notes
  1. Cascade delete ensures documents are removed when a contract is deleted
  2. Storage bucket policies allow authenticated users to manage files
*/

CREATE TABLE IF NOT EXISTS contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contract documents"
  ON contract_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload contract documents"
  ON contract_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete contract documents"
  ON contract_documents FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id
  ON contract_documents(contract_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents',
  'contract-documents',
  false,
  26214400,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to contract-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contract-documents');

CREATE POLICY "Authenticated users can read from contract-documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contract-documents');

CREATE POLICY "Authenticated users can delete from contract-documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contract-documents');
