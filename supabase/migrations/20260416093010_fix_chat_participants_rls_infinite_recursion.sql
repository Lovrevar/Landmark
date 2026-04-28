/*
  # Fix chat_participants RLS infinite recursion

  1. Problem
    - The SELECT and INSERT policies on `chat_participants` reference the same table,
      causing infinite recursion when Postgres evaluates the policy.

  2. Solution
    - Drop the recursive policies
    - Replace SELECT with a direct check: user can see participant rows
      where they themselves are a participant of that conversation
      (using a subquery against `chat_conversations` to break the cycle)
    - Replace INSERT with a simpler check: either you are the conversation creator
      (adding initial participants) or you are already a participant (adding others)
    - Use a SECURITY DEFINER helper function to bypass RLS when checking membership
*/

-- Helper function to check conversation membership without triggering RLS
CREATE OR REPLACE FUNCTION is_chat_participant(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON chat_participants;
DROP POLICY IF EXISTS "Conversation participants can add new participants" ON chat_participants;

-- New SELECT policy using the helper function
CREATE POLICY "Users can view participants of their conversations"
  ON chat_participants FOR SELECT
  TO authenticated
  USING (
    is_chat_participant(
      conversation_id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );

-- New INSERT policy: conversation creator or existing participant can add people
CREATE POLICY "Users can add participants to conversations"
  ON chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_participants.conversation_id
      AND chat_conversations.created_by = (
        SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
      )
    )
    OR
    is_chat_participant(
      conversation_id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );
