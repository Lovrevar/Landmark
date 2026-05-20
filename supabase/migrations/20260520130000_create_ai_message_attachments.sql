/*
  # AI Chat — message attachments

  User-sent images, PDFs, and text-derived files (TXT/CSV/Excel) attached to
  ai_messages rows. The Anthropic Messages API sees these as multimodal
  content blocks (image / document / text) which are persisted directly into
  the owning ai_messages.content JSONB — that JSONB is the authoritative
  replay format. This side-table exists to render chips/thumbnails in the UI
  (filename, size, kind, signed-URL target) and to bound storage cleanup on
  message delete via ON DELETE CASCADE.

  1. New Table
     - `ai_message_attachments`
       - One row per attached file. `message_id` points at the owning
         ai_messages row; cascade-delete keeps the side-table consistent
         when a message (or its session) goes away.
       - `kind` is one of 'image' | 'pdf' | 'text'. `extracted_text` is the
         client-extracted UTF-8 representation for kind='text' (already
         truncated to ≤50 KB by the time it lands here) and is NULL for the
         other kinds.
       - `storage_path` is the object path in the private
         `ai-chat-attachments` bucket. Convention is
         `{auth_user_id}/{session_id}/{uuid}.{ext}` — the bucket RLS in the
         sibling migration enforces the first path segment.

  2. Indexes
     - `ai_message_attachments_message_id_idx` (message_id) — every render
       and lifecycle path looks up attachments by their owning message.

  3. Security
     - RLS enabled, owner-scoped through the owning ai_messages →
       ai_sessions → public.users chain. Same canonical scalar subquery
       (`SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()`)
       used by ai_sessions / ai_messages.
     - Four separate policies (SELECT / INSERT / UPDATE / DELETE).
*/

CREATE TABLE ai_message_attachments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id     uuid        NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  storage_path   text        NOT NULL,
  file_name      text        NOT NULL,
  file_size      integer     NOT NULL CHECK (file_size > 0),
  mime_type      text        NOT NULL,
  kind           text        NOT NULL CHECK (kind IN ('image', 'pdf', 'text')),
  extracted_text text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'text') OR (extracted_text IS NULL))
);

CREATE INDEX ai_message_attachments_message_id_idx
  ON public.ai_message_attachments (message_id);

ALTER TABLE ai_message_attachments ENABLE ROW LEVEL SECURITY;

-- attachments → ai_messages → ai_sessions → public.users → auth.uid()
CREATE POLICY "Users can view attachments in their own AI sessions"
  ON ai_message_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_messages m
      JOIN public.ai_sessions s ON s.id = m.session_id
      WHERE m.id = ai_message_attachments.message_id
        AND s.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can insert attachments in their own AI sessions"
  ON ai_message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_messages m
      JOIN public.ai_sessions s ON s.id = m.session_id
      WHERE m.id = ai_message_attachments.message_id
        AND s.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can update attachments in their own AI sessions"
  ON ai_message_attachments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_messages m
      JOIN public.ai_sessions s ON s.id = m.session_id
      WHERE m.id = ai_message_attachments.message_id
        AND s.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_messages m
      JOIN public.ai_sessions s ON s.id = m.session_id
      WHERE m.id = ai_message_attachments.message_id
        AND s.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can delete attachments in their own AI sessions"
  ON ai_message_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_messages m
      JOIN public.ai_sessions s ON s.id = m.session_id
      WHERE m.id = ai_message_attachments.message_id
        AND s.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
        )
    )
  );
