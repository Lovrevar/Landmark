/*
  # Create task comments table

  1. New Tables
    - `task_comments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, FK to tasks)
      - `user_id` (uuid, FK to auth.users)
      - `comment` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `task_comments`
    - SELECT: users can read comments on tasks they created or are assigned to
    - INSERT: users can create comments on tasks they created or are assigned to
    - UPDATE/DELETE: only comment author
*/

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read comments on their tasks"
  ON task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create comments on their tasks"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Comment author can update own comments"
  ON task_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Comment author can delete own comments"
  ON task_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
