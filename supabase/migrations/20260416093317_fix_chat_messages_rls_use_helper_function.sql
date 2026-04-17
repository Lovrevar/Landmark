/*
  # Fix chat_messages RLS policies to use helper function

  1. Problem
    - The SELECT and INSERT policies on `chat_messages` query `chat_participants`
      directly, which can trigger the RLS recursion issue on `chat_participants`.

  2. Solution
    - Replace direct `chat_participants` subqueries with the `is_chat_participant`
      SECURITY DEFINER helper function that bypasses RLS.
*/

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON chat_messages;

CREATE POLICY "Users can view messages in their conversations"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    is_chat_participant(
      conversation_id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    AND is_chat_participant(
      conversation_id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );
