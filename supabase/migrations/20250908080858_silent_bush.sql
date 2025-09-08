/*
  # Create project phases management system

  1. New Tables
    - `project_phases`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `phase_number` (integer)
      - `phase_name` (text)
      - `budget_allocated` (numeric)
      - `budget_used` (numeric)
      - `start_date` (date)
      - `end_date` (date)
      - `status` (text)
      - `created_at` (timestamp)

  2. Table Updates
    - Add `phase_id` to `subcontractors` table to link subcontractors to specific phases

  3. Security
    - Enable RLS on `project_phases` table
    - Add policy for authenticated users to access project phases
*/

-- Create project_phases table
CREATE TABLE IF NOT EXISTS project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_number integer NOT NULL,
  phase_name text NOT NULL,
  budget_allocated numeric(15,2) DEFAULT 0,
  budget_used numeric(15,2) DEFAULT 0,
  start_date date,
  end_date date,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'on_hold')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, phase_number)
);

-- Add phase_id to subcontractors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcontractors' AND column_name = 'phase_id'
  ) THEN
    ALTER TABLE subcontractors ADD COLUMN phase_id uuid REFERENCES project_phases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Authenticated users can access project phases"
  ON project_phases
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);