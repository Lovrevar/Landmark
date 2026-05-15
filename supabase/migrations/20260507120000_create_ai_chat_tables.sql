/*
  # AI Chat Tables

  Backing store for the read-only AI assistant feature. Each user owns many
  ai_sessions (chat threads); each session has an ordered stream of
  ai_messages exchanged between the user and the Claude assistant via the
  edge function tool layer.

  1. New Tables
    - `ai_sessions`
      - One row per chat thread, owned by a single user via
        `user_id` → `public.users.id`.
      - `title` is nullable — the edge function populates it lazily from
        the first user turn; it can also be edited manually later.
      - `created_at` / `updated_at` track thread freshness; the latter is
        bumped automatically on every UPDATE via the canonical trigger
        function `public.update_updated_at_column()`.
    - `ai_messages`
      - One row per turn in the conversation; the conversation is
        reconstructed in order via (`session_id`, `created_at`).
      - `role` is restricted to `'user'` or `'assistant'`. Tool calls and
        tool results travel inside `content` as Anthropic-style content
        blocks — there is intentionally no `'tool'` role.
      - `model`, `input_tokens`, `output_tokens`, `stop_reason` are
        nullable and only populated on `assistant` rows by the edge
        function.

  2. Indexes
    - `ai_sessions_user_id_updated_at_idx` (user_id, updated_at DESC)
      supports the dominant list query: "my recent threads, newest first".
    - `ai_messages_session_id_created_at_idx` (session_id, created_at)
      supports loading a thread's messages in order, and is the access
      path used by the RLS subquery joining a message to its owning
      session.

  3. Triggers
    - `ai_sessions` reuses the canonical `public.update_updated_at_column()`
      function (defined elsewhere) to maintain `updated_at` on UPDATE.
    - `ai_messages` has no `updated_at` column and no trigger.

  4. Security
    - RLS enabled on both tables.
    - Owner-scoped via the canonical scalar subquery
      `(SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid())`,
      mirroring the chat_* policy style.
    - Four separate policies per table (SELECT / INSERT / UPDATE / DELETE).

  ai_messages is append-only by application contract: no UI path mutates
  message rows after insert. RLS still permits owner-scoped UPDATE in v1
  — append-only is NOT enforced at the database level. Do not assume DB
  immutability when reasoning about message rows.
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE ai_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid        NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  role           text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content        jsonb       NOT NULL,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  stop_reason    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX ai_sessions_user_id_updated_at_idx
  ON public.ai_sessions (user_id, updated_at DESC);

CREATE INDEX ai_messages_session_id_created_at_idx
  ON public.ai_messages (session_id, created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_ai_sessions_updated_at
  BEFORE UPDATE ON public.ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- ai_sessions: owner-scoped CRUD
CREATE POLICY "Users can view their own AI sessions"
  ON ai_sessions FOR SELECT
  TO authenticated
  USING (
    user_id = (
      SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create AI sessions for themselves"
  ON ai_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (
      SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own AI sessions"
  ON ai_sessions FOR UPDATE
  TO authenticated
  USING (
    user_id = (
      SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = (
      SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own AI sessions"
  ON ai_sessions FOR DELETE
  TO authenticated
  USING (
    user_id = (
      SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

-- ai_messages: scoped via owning session
CREATE POLICY "Users can view messages in their own AI sessions"
  ON ai_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = ai_messages.session_id
      AND s.user_id = (
        SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can send messages in their own AI sessions"
  ON ai_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = ai_messages.session_id
      AND s.user_id = (
        SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update messages in their own AI sessions"
  ON ai_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = ai_messages.session_id
      AND s.user_id = (
        SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = ai_messages.session_id
      AND s.user_id = (
        SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete messages in their own AI sessions"
  ON ai_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = ai_messages.session_id
      AND s.user_id = (
        SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );
