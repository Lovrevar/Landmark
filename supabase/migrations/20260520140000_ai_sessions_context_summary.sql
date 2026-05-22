/*
  # AI Chat — context-window compaction columns

  A long-lived chat thread would otherwise replay its entire message history
  to Anthropic on every turn and eventually exceed the model's context
  window. To bound this, the edge function keeps a running summary of the
  older part of each conversation and only replays the recent turns verbatim.

  These two columns hold that running summary. They are written exclusively
  by the `ai-chat` edge function's post-turn compaction step; the normal
  message write path never touches them.

  1. New Columns on `ai_sessions`
    - `context_summary` — the running natural-language summary of every turn
      older than the most recent ones. NULL until a thread grows long enough
      to need its first compaction.
    - `summary_through_message_id` — the `ai_messages.id` of the LAST message
      covered by `context_summary`. The summary is valid for a given branch
      only if this id appears in that branch's ancestor chain; if the user
      branched (edit/regenerate) before this point, the summary is ignored
      and recomputed. `ON DELETE SET NULL` so deleting the boundary message
      cleanly invalidates the summary rather than dangling.

  2. Security
    - No RLS change. `ai_sessions` already has owner-scoped policies; these
      columns are covered by the existing SELECT/UPDATE policies. The edge
      function writes them with the service-role client under an explicit
      `user_id` filter, same as `title` backfill.
*/

ALTER TABLE public.ai_sessions
  ADD COLUMN context_summary text,
  ADD COLUMN summary_through_message_id uuid
    REFERENCES public.ai_messages(id) ON DELETE SET NULL;
