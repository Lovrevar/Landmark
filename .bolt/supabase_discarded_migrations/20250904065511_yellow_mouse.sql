/*
# Create tasks table

1. New Tables
   - `tasks`
     - `id` (uuid, primary key)
     - `project_id` (uuid, foreign key to projects)
     - `name` (text)
     - `description` (text)
     - `assigned_to` (text)
     - `deadline` (date)
     - `status` (text, enum)
     - `progress` (integer, 0-100)
     - `created_at` (timestamp)

2. Security
   - Enable RLS on `tasks` table
   - Add policy for authenticated users to access tasks

3. Sample Data
   - Insert sample tasks for testing
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  assigned_to text NOT NULL,
  deadline date NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (true);

-- Insert sample tasks
INSERT INTO tasks (project_id, name, description, assigned_to, deadline, status, progress) 
SELECT 
  p.id,
  task_data.name,
  task_data.description,
  task_data.assigned_to,
  task_data.deadline,
  task_data.status,
  task_data.progress
FROM projects p,
(VALUES 
  ('Foundation Work', 'Complete foundation excavation and concrete pouring', 'ABC Construction Crew', '2024-02-15', 'Completed', 100),
  ('Electrical Installation', 'Install electrical systems on floors 1-5', 'ElectricPro LLC', '2024-04-30', 'In Progress', 75),
  ('Plumbing Setup', 'Install plumbing systems for all units', 'PlumbRight Inc', '2024-05-15', 'In Progress', 60)
) AS task_data(name, description, assigned_to, deadline, status, progress)
WHERE p.name = 'Sunset Towers';