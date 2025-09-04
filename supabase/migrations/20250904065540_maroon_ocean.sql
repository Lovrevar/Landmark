/*
# Create todos table for personal task management

1. New Tables
   - `todos`
     - `id` (uuid, primary key)
     - `user_id` (uuid, foreign key to users)
     - `title` (text)
     - `description` (text)
     - `completed` (boolean)
     - `due_date` (date, nullable)
     - `created_at` (timestamp)

2. Security
   - Enable RLS on `todos` table
   - Add policy for users to access only their own todos
*/

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  completed boolean DEFAULT false,
  due_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own todos"
  ON todos
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());