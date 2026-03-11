/*
  # Create Credit Allocations Table

  1. New Tables
    - `credit_allocations`
      - `id` (uuid, primary key)
      - `credit_id` (uuid, foreign key to bank_credits)
      - `project_id` (uuid, nullable, foreign key to projects) - NULL means OPEX
      - `allocated_amount` (numeric) - Amount allocated from credit to project
      - `description` (text) - Description/purpose of allocation
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `credit_allocations` table
    - Add policies for authenticated users to manage allocations

  3. Indexes
    - Add indexes for credit_id and project_id for faster queries
*/

CREATE TABLE IF NOT EXISTS credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES bank_credits(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  allocated_amount numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_allocations_credit_id ON credit_allocations(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_allocations_project_id ON credit_allocations(project_id);

ALTER TABLE credit_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view credit allocations"
  ON credit_allocations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create credit allocations"
  ON credit_allocations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update credit allocations"
  ON credit_allocations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete credit allocations"
  ON credit_allocations FOR DELETE
  TO authenticated
  USING (true);
