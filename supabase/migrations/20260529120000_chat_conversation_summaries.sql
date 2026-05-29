-- Performance: replace the client-side "download all message history and compute
-- last-message + unread counts in JS" path in chatService.fetchConversations with a
-- single server-side summary. Returns one row per conversation the caller belongs to,
-- with the last message inlined and the unread count computed in Postgres. Both
-- LATERAL subqueries are served by the existing index
-- idx_chat_messages_conversation_created (conversation_id, created_at DESC), so the
-- cost is bounded by the number of conversations, not the total message volume.
--
-- SECURITY DEFINER + explicit auth.uid() scoping (mirrors get_invoice_statistics):
-- the function only ever returns the caller's own conversations, so it does not need
-- the per-row is_chat_participant() RLS check. Access is membership-based (no role gate).

CREATE OR REPLACE FUNCTION public.get_chat_conversation_summaries()
RETURNS TABLE (
  id              uuid,
  name            text,
  is_group        boolean,
  created_by      uuid,
  created_at      timestamptz,
  last_message_id uuid,
  last_content    text,
  last_created_at timestamptz,
  last_sender_id  uuid,
  last_file_url   text,
  last_file_name  text,
  last_file_size  bigint,
  last_file_type  text,
  unread_count    bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (
    SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
  ),
  my_convs AS (
    SELECT cp.conversation_id, cp.last_read_at
    FROM chat_participants cp
    WHERE cp.user_id = (SELECT id FROM me)
  )
  SELECT
    c.id, c.name, c.is_group, c.created_by, c.created_at,
    lm.id, lm.content, lm.created_at, lm.sender_id,
    lm.file_url, lm.file_name, lm.file_size, lm.file_type,
    COALESCE(uc.cnt, 0)
  FROM chat_conversations c
  JOIN my_convs mc ON mc.conversation_id = c.id
  LEFT JOIN LATERAL (
    SELECT m.id, m.content, m.created_at, m.sender_id,
           m.file_url, m.file_name, m.file_size, m.file_type
    FROM chat_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM chat_messages m2
    WHERE m2.conversation_id = c.id
      AND m2.created_at > mc.last_read_at
      AND m2.sender_id <> (SELECT id FROM me)
  ) uc ON true
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_conversation_summaries() TO authenticated;
