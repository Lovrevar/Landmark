/*
  # Create TIC Cost Structures Table

  1. New Tables
    - `tic_cost_structures`
      - `id` (uuid, primary key)
      - `investor_name` (text) - Name of the investor
      - `document_date` (date) - Date of the document
      - `line_items` (jsonb) - Array of cost line items with vlastita_sredstva and kreditna_sredstva amounts
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - Reference to users table

  2. Security
    - Enable RLS on `tic_cost_structures` table
    - Add policies for authenticated users to manage their cost structures
*/

CREATE TABLE IF NOT EXISTS tic_cost_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_name text NOT NULL DEFAULT 'RAVNICE CITY D.O.O.',
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

ALTER TABLE tic_cost_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all TIC cost structures"
  ON tic_cost_structures
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create TIC cost structures"
  ON tic_cost_structures
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update TIC cost structures"
  ON tic_cost_structures
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete TIC cost structures"
  ON tic_cost_structures
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_tic_cost_structures_created_by ON tic_cost_structures(created_by);
CREATE INDEX IF NOT EXISTS idx_tic_cost_structures_created_at ON tic_cost_structures(created_at DESC);
