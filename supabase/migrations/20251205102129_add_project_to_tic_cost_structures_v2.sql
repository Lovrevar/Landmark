/*
  # Add Project to TIC Cost Structures

  1. Changes
    - Add `project_id` column to `tic_cost_structures` table
    - Add foreign key constraint to `projects` table
    - Add index for performance
    - Update RLS policies to check project access

  2. Notes
    - Allows each TIC cost structure to be associated with a specific project
    - Users with access to the project can view/edit its TIC
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tic_cost_structures' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE tic_cost_structures ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tic_cost_structures_project_id ON tic_cost_structures(project_id);

DROP POLICY IF EXISTS "Users can view all TIC cost structures" ON tic_cost_structures;
DROP POLICY IF EXISTS "Users can create TIC cost structures" ON tic_cost_structures;
DROP POLICY IF EXISTS "Users can update TIC cost structures" ON tic_cost_structures;
DROP POLICY IF EXISTS "Users can delete TIC cost structures" ON tic_cost_structures;

CREATE POLICY "Users can view TIC cost structures for their projects"
  ON tic_cost_structures
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tic_cost_structures.project_id
    )
  );

CREATE POLICY "Users can create TIC cost structures for projects"
  ON tic_cost_structures
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update TIC cost structures for their projects"
  ON tic_cost_structures
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tic_cost_structures.project_id
    )
  )
  WITH CHECK (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tic_cost_structures.project_id
    )
  );

CREATE POLICY "Users can delete TIC cost structures for their projects"
  ON tic_cost_structures
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tic_cost_structures.project_id
    )
  );
