/*
# Create subcontractors table

1. New Tables
   - `subcontractors`
     - `id` (uuid, primary key)
     - `name` (text)
     - `contact` (text)
     - `job_description` (text)
     - `progress` (integer, 0-100)
     - `deadline` (date)
     - `cost` (numeric)
     - `created_at` (timestamp)

2. Security
   - Enable RLS on `subcontractors` table
   - Add policy for authenticated users to access subcontractors

3. Sample Data
   - Insert sample subcontractors for testing
*/

CREATE TABLE IF NOT EXISTS subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text NOT NULL,
  job_description text NOT NULL,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  deadline date NOT NULL,
  cost numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access subcontractors"
  ON subcontractors
  FOR ALL
  TO authenticated
  USING (true);

-- Insert sample subcontractors
INSERT INTO subcontractors (name, contact, job_description, progress, deadline, cost) VALUES 
  ('ABC Construction Crew', 'john@abcconstruction.com', 'Foundation and structural work', 100, '2024-02-15', 125000.00),
  ('ElectricPro LLC', 'mike@electricpro.com', 'Electrical systems installation', 75, '2024-04-30', 85000.00),
  ('PlumbRight Inc', 'sarah@plumbright.com', 'Plumbing systems and fixtures', 60, '2024-05-15', 95000.00),
  ('Windows & More', 'tom@windowsmore.com', 'Window and door installation', 25, '2024-06-30', 65000.00);