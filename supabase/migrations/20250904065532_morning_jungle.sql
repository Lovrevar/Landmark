/*
# Create apartments table

1. New Tables
   - `apartments`
     - `id` (uuid, primary key)
     - `project_id` (uuid, foreign key to projects)
     - `number` (text)
     - `floor` (integer)
     - `size_m2` (numeric)
     - `price` (numeric)
     - `status` (text, enum)
     - `buyer_name` (text, nullable)
     - `created_at` (timestamp)

2. Security
   - Enable RLS on `apartments` table
   - Add policy for authenticated users to access apartments

3. Sample Data
   - Insert sample apartments for testing
*/

CREATE TABLE IF NOT EXISTS apartments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number text NOT NULL,
  floor integer NOT NULL,
  size_m2 numeric(8,2) NOT NULL,
  price numeric(15,2) NOT NULL,
  status text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'Sold')),
  buyer_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access apartments"
  ON apartments
  FOR ALL
  TO authenticated
  USING (true);

-- Insert sample apartments
INSERT INTO apartments (project_id, number, floor, size_m2, price, status, buyer_name)
SELECT 
  p.id,
  apt_data.number,
  apt_data.floor,
  apt_data.size_m2,
  apt_data.price,
  apt_data.status,
  apt_data.buyer_name
FROM projects p,
(VALUES 
  ('101', 1, 75.5, 285000.00, 'Sold', 'John Smith'),
  ('102', 1, 82.3, 310000.00, 'Available', null),
  ('103', 1, 68.7, 265000.00, 'Reserved', 'Maria Garcia'),
  ('201', 2, 75.5, 290000.00, 'Available', null),
  ('202', 2, 82.3, 315000.00, 'Available', null),
  ('203', 2, 68.7, 270000.00, 'Sold', 'Robert Johnson')
) AS apt_data(number, floor, size_m2, price, status, buyer_name)
WHERE p.name = 'Sunset Towers';