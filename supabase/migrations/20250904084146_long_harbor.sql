/*
  # Create invoices table

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `amount` (numeric, invoice amount)
      - `due_date` (date, payment due date)
      - `paid` (boolean, payment status)
      - `subcontractor_id` (uuid, optional foreign key to subcontractors)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `invoices` table
    - Add policy for authenticated users to access invoices
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