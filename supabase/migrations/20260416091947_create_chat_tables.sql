/*
  # Create Chat System Tables

  1. New Tables
    - `chat_conversations`
      - `id` (uuid, primary key)
      - `name` (text, nullable - used for group chat names like "Precko Zapad")
      - `is_group` (boolean, default false - distinguishes 1-on-1 from group chats)
      - `created_by` (uuid, FK to users.id - who created the conversation)
      - `created_at` (timestamptz)

    - `chat_participants`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, FK to chat_conversations.id)
      - `user_id` (uuid, FK to users.id)
      - `joined_at` (timestamptz)
      - `last_read_at` (timestamptz - tracks unread messages per user)
      - Unique constraint on (conversation_id, user_id)

    - `chat_messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, FK to chat_conversations.id)
      - `sender_id` (uuid, FK to users.id)
      - `content` (text, message body)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all three tables
    - Users can only access conversations they participate in
    - Users can only send messages in conversations they participate in
    - Users can only read messages from conversations they participate in

  3. Performance Indexes
    - `chat_messages(conversation_id, created_at)` for fast message retrieval
    - `chat_participants(user_id)` for fast conversation lookup
    - `chat_participants(conversation_id)` for fast participant lookup

  4. Realtime
    - Enabled on `chat_messages` for live message delivery
*/

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Chat participants junction table
CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON chat_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user
  ON chat_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation
  ON chat_participants(conversation_id);

-- RLS Policies for chat_conversations
CREATE POLICY "Users can view conversations they participate in"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.conversation_id = chat_conversations.id
      AND chat_participants.user_id = (
        SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can create conversations"
  ON chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Conversation creator can update conversation"
  ON chat_conversations FOR UPDATE
  TO authenticated
  USING (
    created_by = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Conversation creator can delete conversation"
  ON chat_conversations FOR DELETE
  TO authenticated
  USING (
    created_by = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

-- RLS Policies for chat_participants
CREATE POLICY "Users can view participants of their conversations"
  ON chat_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.conversation_id = chat_participants.conversation_id
      AND cp.user_id = (
        SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Conversation participants can add new participants"
  ON chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.conversation_id = chat_participants.conversation_id
      AND cp.user_id = (
        SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
      )
    )
    OR
    chat_participants.user_id = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participant record"
  ON chat_participants FOR UPDATE
  TO authenticated
  USING (
    user_id = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove themselves from conversations"
  ON chat_participants FOR DELETE
  TO authenticated
  USING (
    user_id = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their conversations"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.conversation_id = chat_messages.conversation_id
      AND chat_participants.user_id = (
        SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_participants.conversation_id = chat_messages.conversation_id
      AND chat_participants.user_id = (
        SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (
    sender_id = (
      SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

-- Enable Realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
