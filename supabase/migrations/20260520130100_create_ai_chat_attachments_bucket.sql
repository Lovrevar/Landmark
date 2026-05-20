/*
  # AI Chat — private storage bucket

  Creates the `ai-chat-attachments` bucket and the owner-only RLS policies on
  storage.objects that scope read/write to the user's own prefix.

  Unlike `chat-attachments` (public, used by the messaging Chat module) this
  bucket is PRIVATE — every read must go through `createSignedUrl`. The
  path convention is `{auth_user_id}/{session_id}/{uuid}.{ext}`; the first
  path segment is the auth.users.id (not public.users.id) because that is
  what `auth.uid()` returns. The upload service must read
  `supabase.auth.getUser().data.user.id` for this segment, and the edge
  function validates it server-side via `ctx.authUserId`.

  This is the first migration in the repo that creates a Storage bucket
  programmatically; bucket creation is normally done via the Supabase
  dashboard. The INSERT is idempotent (`ON CONFLICT (id) DO NOTHING`) so
  reruns and dashboard-then-migration ordering both work.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-chat-attachments', 'ai-chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-only access: the first path segment must match auth.uid().
-- storage.foldername(name) splits on '/'; element [1] is the first folder.

CREATE POLICY "ai-chat-attachments owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ai-chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ai-chat-attachments owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ai-chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ai-chat-attachments owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'ai-chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'ai-chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ai-chat-attachments owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ai-chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
