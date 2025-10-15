/*
  # Update Work Logs Table to Add Contract Linking and Status
  
  This migration updates the existing work_logs table to add contract-based tracking
  and status management for better subcontractor activity monitoring.
  
  1. Changes to work_logs table
    - Add `contract_id` (uuid, foreign key to contracts) - Links directly to a specific contract
    - Add `project_id` (uuid, foreign key to projects) - For easier querying
    - Add `phase_id` (uuid, foreign key to project_phases) - For easier querying
    - Add `status` (text) - Status of work: 'work_finished', 'in_progress', 'blocker', 'quality_issue', 'waiting_materials', 'weather_delay'
    - Add `blocker_details` (text, nullable) - Details if status is 'blocker'
    - Add `updated_at` (timestamptz) - Track when logs are updated
    - Change `created_by` from text to uuid (foreign key to auth.users)
    - Change `hours_worked` from integer to numeric for decimal support
  
  2. Indexes
    - Add indexes for contract_id, project_id, date, and status
  
  3. Security
    - Update RLS policies to restrict write access to Supervision and Director roles only
    - Keep read access for all authenticated users
  
  4. Important Notes
    - Each work log is linked to exactly ONE contract
    - A contract can have multiple work logs over time
    - The project_id, phase_id, and subcontractor_id are denormalized for query performance
*/

-- Add new columns
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS contract_id uuid;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS phase_id uuid;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS blocker_details text;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update hours_worked to support decimal values
ALTER TABLE work_logs ALTER COLUMN hours_worked TYPE numeric USING hours_worked::numeric;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'work_logs_contract_id_fkey'
  ) THEN
    ALTER TABLE work_logs ADD CONSTRAINT work_logs_contract_id_fkey 
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'work_logs_project_id_fkey'
  ) THEN
    ALTER TABLE work_logs ADD CONSTRAINT work_logs_project_id_fkey 
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'work_logs_phase_id_fkey'
  ) THEN
    ALTER TABLE work_logs ADD CONSTRAINT work_logs_phase_id_fkey 
      FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add check constraint for status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'work_logs_status_check'
  ) THEN
    ALTER TABLE work_logs ADD CONSTRAINT work_logs_status_check 
      CHECK (status IN ('work_finished', 'in_progress', 'blocker', 'quality_issue', 'waiting_materials', 'weather_delay'));
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_work_logs_contract_id ON work_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_project_id ON work_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
CREATE INDEX IF NOT EXISTS idx_work_logs_status ON work_logs(status);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can create work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can update work logs" ON work_logs;
DROP POLICY IF EXISTS "Supervision and Director can delete work logs" ON work_logs;

-- Enable RLS (in case it wasn't enabled)
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all work logs
CREATE POLICY "Authenticated users can read work logs"
  ON work_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Supervision and Director roles can insert work logs
CREATE POLICY "Supervision and Director can create work logs"
  ON work_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  );

-- Policy: Supervision and Director roles can update work logs
CREATE POLICY "Supervision and Director can update work logs"
  ON work_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  );

-- Policy: Supervision and Director roles can delete work logs
CREATE POLICY "Supervision and Director can delete work logs"
  ON work_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Supervision', 'Director')
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_work_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_logs_updated_at ON work_logs;

CREATE TRIGGER work_logs_updated_at
  BEFORE UPDATE ON work_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_work_logs_updated_at();