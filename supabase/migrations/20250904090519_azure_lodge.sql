

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
;