

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  assigned_to text NOT NULL,
  deadline date NOT NULL,
  status text DEFAULT 'Pending' NOT NULL,
  progress integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);


-- Add constraints
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status = ANY (ARRAY['Pending'::text, 'In Progress'::text, 'Completed'::text, 'Overdue'::text]));


ALTER TABLE tasks ADD CONSTRAINT tasks_progress_check 
  CHECK (progress >= 0 AND progress <= 100);


-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;


-- Create policy for authenticated users
CREATE POLICY "Authenticated users can access tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (true);
;