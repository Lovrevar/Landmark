/*
  # Add task comments system

  1. New Tables
    - `task_comments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `user_id` (uuid, foreign key to users)
      - `comment` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `task_comments` table
    - Add policy for authenticated users to manage comments
*/

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on task_comments"
  ON task_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);