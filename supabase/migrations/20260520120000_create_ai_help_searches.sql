-- ai_help_searches — telemetry for the search_help tool.
--
-- Every call to the help-KB search tool inserts one row here. The intent is to
-- find KB gaps after the fact: queries that returned a low top-similarity, or
-- that returned nothing, are signals to write a new entry.
--
-- Writes are fire-and-forget from the edge function (service role). Reads are
-- Director-only — telemetry is not part of the conversation surface.

CREATE TABLE IF NOT EXISTS public.ai_help_searches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_route    text,
  query            text NOT NULL,
  returned_ids     text[] NOT NULL DEFAULT '{}'::text[],
  top_similarity   numeric(5, 4),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_help_searches_created_at_idx
  ON public.ai_help_searches (created_at DESC);

ALTER TABLE public.ai_help_searches ENABLE ROW LEVEL SECURITY;

-- Director-only SELECT. The edge function writes via service role (RLS bypassed).
DROP POLICY IF EXISTS ai_help_searches_director_select ON public.ai_help_searches;
CREATE POLICY ai_help_searches_director_select
  ON public.ai_help_searches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND u.role = 'Director'
    )
  );
