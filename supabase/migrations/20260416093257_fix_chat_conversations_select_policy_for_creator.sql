/*
  # Fix chat_conversations SELECT policy for creator

  1. Problem
    - When creating a conversation, the INSERT succeeds but the subsequent
      `.select('id')` fails because the SELECT policy only checks
      `chat_participants` -- which has no rows yet at that point.

  2. Solution
    - Update the SELECT policy to also allow the conversation creator
      to see the conversation (not only via participants).
    - Uses the `is_chat_participant` SECURITY DEFINER function to avoid
      recursion when checking participants.
*/

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON chat_conversations;

CREATE POLICY "Users can view conversations they participate in"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR
    is_chat_participant(
      id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );
