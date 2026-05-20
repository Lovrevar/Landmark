/*
  # AI Chat — message tree (branching for edits & regenerates)

  Replaces the previous append-only model with a parent-pointer tree. Each
  message row points at its parent (the previous turn it answers / extends);
  the conversation rendered in the UI is one root-to-leaf path through this
  tree. Editing a user message or regenerating an assistant response no
  longer deletes anything — instead a new row is inserted as a sibling of
  the original, and the UI offers a ‹ N/M › switcher to flip between
  siblings. This matches Claude.ai / ChatGPT semantics.

  Active branch resolution is implicit on reload: the row with the largest
  `created_at` in the session is the active leaf; walking parents to root
  yields the active path. Branch switches are client-side only — they
  do not persist across reloads.

  Backfill chains every existing row in `created_at` order within its
  session. After backfill, the first row in each session has parent_id =
  NULL and every other row points at the row that came before it.
*/

ALTER TABLE public.ai_messages
  ADD COLUMN parent_id uuid REFERENCES public.ai_messages(id) ON DELETE CASCADE;

-- Backfill: chain rows by created_at within each session. The earliest row
-- in each session keeps parent_id = NULL.
WITH chained AS (
  SELECT id,
         LAG(id) OVER (PARTITION BY session_id ORDER BY created_at ASC, id ASC) AS prev_id
  FROM public.ai_messages
)
UPDATE public.ai_messages m
SET parent_id = c.prev_id
FROM chained c
WHERE m.id = c.id
  AND c.prev_id IS NOT NULL;

-- Sibling lookup ("siblings of row R" = SELECT ... WHERE parent_id = R.parent_id)
-- and the recursive walk both pivot on parent_id.
CREATE INDEX ai_messages_parent_id_idx ON public.ai_messages (parent_id);

COMMENT ON COLUMN public.ai_messages.parent_id IS
  'Tree pointer: the previous message this row continues from. NULL on the '
  'first row of each session. Siblings (rows sharing parent_id within the '
  'same session) represent branches created by edit/regenerate.';
