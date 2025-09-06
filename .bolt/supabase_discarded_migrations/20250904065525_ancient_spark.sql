/*
# Create invoices table

1. New Tables
   - `invoices`
     - `id` (uuid, primary key)
     - `project_id` (uuid, foreign key to projects)
     - `amount` (numeric)
     - `due_date` (date)
     - `paid` (boolean)
     - `subcontractor_id` (uuid, foreign key to subcontractors)
     - `created_at` (timestamp)

2. Security
   - Enable RLS on `invoices` table
   - Add policy for authenticated users to access invoices

3. Sample Data
   - Insert sample invoices for testing
*/

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid boolean DEFAULT false,
  subcontractor_id uuid REFERENCES subcontractors(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access invoices"
  ON invoices
  FOR ALL
  TO authenticated
  USING (true);

-- Insert sample invoices
INSERT INTO invoices (project_id, amount, due_date, paid, subcontractor_id)
SELECT 
  p.id,
  inv_data.amount,
  inv_data.due_date,
  inv_data.paid,
  s.id
FROM projects p,
     subcontractors s,
(VALUES 
  ('ABC Construction Crew', 125000.00, '2024-02-01', true),
  ('ElectricPro LLC', 42500.00, '2024-03-15', true),
  ('ElectricPro LLC', 42500.00, '2024-04-15', false),
  ('PlumbRight Inc', 47500.00, '2024-04-01', false)
) AS inv_data(contractor_name, amount, due_date, paid)
WHERE p.name = 'Sunset Towers' AND s.name = inv_data.contractor_name;