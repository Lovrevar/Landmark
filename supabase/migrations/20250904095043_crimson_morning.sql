

CREATE TABLE IF NOT EXISTS work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  date date NOT NULL,
  workers_count integer NOT NULL DEFAULT 1,
  work_description text NOT NULL,
  hours_worked integer NOT NULL DEFAULT 8,
  notes text DEFAULT '',
  photos text[] DEFAULT '{}',
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);


-- Disable RLS for work_logs table to allow all operations
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;
;