

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  budget numeric(15,2) NOT NULL DEFAULT 0,
  investor text,
  status text NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'In Progress', 'Completed', 'On Hold')),
  created_at timestamptz DEFAULT now()
);


ALTER TABLE projects ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Authenticated users can access projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (true);


-- Insert sample projects
INSERT INTO projects (name, location, start_date, end_date, budget, investor, status) VALUES 
  ('Sunset Towers', '123 Main St, Downtown', '2024-01-15', '2025-06-30', 2500000.00, 'Metro Investment Group', 'In Progress'),
  ('Riverside Apartments', '456 River Ave, Midtown', '2024-03-01', '2025-12-31', 1800000.00, 'Blue Capital Partners', 'In Progress'),
  ('Golden Heights', '789 Hill Rd, Uptown', '2024-06-01', '2026-03-30', 3200000.00, 'Sunrise Ventures', 'Planning');
;