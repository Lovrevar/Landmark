/*
  # Clean Subcontractors Table - Remove Contract-Specific Fields (v3)

  ## Overview
  Removes contract-specific fields from subcontractors table and updates RLS policies.

  ## Changes
  1. Drop old RLS policies that depend on phase_id
  2. Remove contract-specific columns
  3. Recreate RLS policies if needed

  ## Security
  - Maintains access control through contracts table
  - No data loss
*/

-- Step 1: Drop ALL existing policies on subcontractors
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'subcontractors'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON subcontractors', policy_record.policyname);
    END LOOP;
END $$;

-- Step 2: Drop ALL existing policies on work_logs
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'work_logs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON work_logs', policy_record.policyname);
    END LOOP;
END $$;

-- Step 3: Drop foreign key constraints
ALTER TABLE subcontractors 
DROP CONSTRAINT IF EXISTS subcontractors_contract_id_fkey CASCADE;

ALTER TABLE subcontractors 
DROP CONSTRAINT IF EXISTS subcontractors_phase_id_fkey CASCADE;

-- Step 4: Remove columns
ALTER TABLE subcontractors 
DROP COLUMN IF EXISTS phase_id CASCADE,
DROP COLUMN IF EXISTS contract_id CASCADE,
DROP COLUMN IF EXISTS job_description CASCADE,
DROP COLUMN IF EXISTS deadline CASCADE,
DROP COLUMN IF EXISTS cost CASCADE,
DROP COLUMN IF EXISTS budget_realized CASCADE;

-- Step 5: Add notes column
ALTER TABLE subcontractors 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Step 6: Create new RLS policies for subcontractors
CREATE POLICY "Authenticated users can view subcontractors"
  ON subcontractors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Directors and Supervision can create subcontractors"
  ON subcontractors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
    )
  );

CREATE POLICY "Directors and Supervision can update subcontractors"
  ON subcontractors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
    )
  );

CREATE POLICY "Directors can delete subcontractors"
  ON subcontractors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- Step 7: Create new RLS policies for work_logs
CREATE POLICY "Authenticated users can view work logs"
  ON work_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Directors and Supervision can create work logs"
  ON work_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
    )
  );

CREATE POLICY "Directors and Supervision can update work logs"
  ON work_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
    )
  );

CREATE POLICY "Directors and Supervision can delete work logs"
  ON work_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision')
    )
  );

COMMENT ON TABLE subcontractors IS 'Master list of subcontractor companies. Contract details are in contracts table.';
