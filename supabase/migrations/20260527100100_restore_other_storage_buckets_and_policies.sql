/*
  # Restore chat-attachments, contract-documents, and task-attachments
  # storage buckets + RLS policies

  Same underlying gap as 20260527100000_restore_documents_bucket_and_policies.sql:
  the 2026-05-15 reconciliation neutered the original setup migrations and the
  baseline pg_dump only captured the `public` schema, so the `storage`-schema
  objects from these three migrations are missing from any environment
  rebuilt from the baseline.

  Originals:
    - 20260224100433_create_contract_documents_table.sql  → contract-documents
    - 20260416101638_add_file_attachments_to_chat_messages.sql → chat-attachments
    - 20260421140000_tasks_redesign.sql                  → task-attachments

  Policy definitions and bucket configs below are copied verbatim from those
  pre-reconciliation files. Fully idempotent — every CREATE POLICY is
  preceded by a DROP IF EXISTS, and every bucket INSERT uses ON CONFLICT.

  NOTE: the task-attachments policies depend on the public helpers
  `is_task_assignee(uuid, uuid)` and `get_task_creator(uuid)`. These are
  defined in the baseline schema and so are present in any environment that
  has run the baseline migration.
*/

-- ============================================================================
-- contract-documents (legacy subcontractor contract PDFs)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contract-documents', 'contract-documents', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload to contract-documents"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read from contract-documents"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from contract-documents" ON storage.objects;

CREATE POLICY "Authenticated users can upload to contract-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-documents');

CREATE POLICY "Authenticated users can read from contract-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-documents');

CREATE POLICY "Authenticated users can delete from contract-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-documents');

-- ============================================================================
-- chat-attachments (chat module file uploads — public bucket)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', true, 26214400, NULL)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat attachments"                 ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat attachments"      ON storage.objects;

CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Anyone can view chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- task-attachments (tasks module file uploads — private, per-task access)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "TaskAttachments storage: read"   ON storage.objects;
DROP POLICY IF EXISTS "TaskAttachments storage: insert" ON storage.objects;
DROP POLICY IF EXISTS "TaskAttachments storage: delete" ON storage.objects;

CREATE POLICY "TaskAttachments storage: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM task_attachments ta
      WHERE ta.storage_path = name
        AND (
          is_task_assignee(ta.task_id, (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()))
          OR get_task_creator(ta.task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
        )
    )
  );

CREATE POLICY "TaskAttachments storage: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "TaskAttachments storage: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM task_attachments ta
      WHERE ta.storage_path = name
        AND (
          ta.uploaded_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
          OR get_task_creator(ta.task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
        )
    )
  );
