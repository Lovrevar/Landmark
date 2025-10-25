/*
  # Create subcontractor_milestones table

  1. New Tables
    - `subcontractor_milestones`
      - `id` (uuid, primary key)
      - `subcontractor_id` (uuid, foreign key to subcontractors)
      - `project_id` (uuid, foreign key to projects)
      - `phase_id` (uuid, foreign key to project_phases)
      - `milestone_number` (integer, sequence number per subcontractor-phase)
      - `milestone_name` (text, e.g., "Projektiranje")
      - `description` (text, detailed description of deliverables)
      - `percentage` (numeric, e.g., 30.00 for 30%)
      - `due_date` (date, when payment should be made)
      - `status` (text, enum: 'pending', 'completed', 'paid')
      - `completed_date` (date, nullable, when work was finished)
      - `paid_date` (date, nullable, when payment was made)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `subcontractor_milestones` table
    - Add policies for authenticated users to manage milestones

  3. Indexes
    - Index on `subcontractor_id` for fast lookups
    - Index on `project_id` for filtering by project
    - Index on `phase_id` for filtering by phase
    - Composite index on (subcontractor_id, phase_id) for contract-specific queries

  4. Constraints
    - Percentage must be between 0 and 100
    - Unique constraint on (subcontractor_id, phase_id, milestone_number)
    - Status must be one of: 'pending', 'completed', 'paid'
*/

CREATE TABLE IF NOT EXISTS subcontractor_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  milestone_number integer NOT NULL,
  milestone_name text NOT NULL,
  description text DEFAULT '',
  percentage numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'paid')),
  completed_date date,
  paid_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subcontractor_id, phase_id, milestone_number)
);

CREATE INDEX IF NOT EXISTS idx_subcontractor_milestones_subcontractor_id ON subcontractor_milestones(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_milestones_project_id ON subcontractor_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_milestones_phase_id ON subcontractor_milestones(phase_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_milestones_subcontractor_phase ON subcontractor_milestones(subcontractor_id, phase_id);

ALTER TABLE subcontractor_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view milestones"
  ON subcontractor_milestones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert milestones"
  ON subcontractor_milestones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update milestones"
  ON subcontractor_milestones FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete milestones"
  ON subcontractor_milestones FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_subcontractor_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subcontractor_milestones_updated_at
  BEFORE UPDATE ON subcontractor_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_milestones_updated_at();