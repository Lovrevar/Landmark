/*
  # Allow Accounting role to create suppliers and contracts

  ## Overview
  Enable Accounting users to create subcontractors and contracts (without formal agreements)
  from the Accounting module. This allows them to add suppliers that can be linked to 
  projects and phases for invoice tracking.

  ## Changes
  1. Update subcontractors INSERT policy to allow Accounting users
  2. Update contracts INSERT policy to allow Accounting users
  3. Update contracts UPDATE policy to allow Accounting users

  ## Notes
  - Accounting can only create contracts with has_contract = false
  - This enables supplier management from the Accounting module
  - Maintains security by restricting to authenticated Accounting users
*/

-- Drop existing INSERT policy for subcontractors
DROP POLICY IF EXISTS "Directors and Supervision can create subcontractors" ON subcontractors;

-- Create new INSERT policy that includes Accounting
CREATE POLICY "Directors, Supervision and Accounting can create subcontractors"
  ON subcontractors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision', 'Accounting')
    )
  );

-- Drop existing UPDATE policy for subcontractors
DROP POLICY IF EXISTS "Directors and Supervision can update subcontractors" ON subcontractors;

-- Create new UPDATE policy that includes Accounting
CREATE POLICY "Directors, Supervision and Accounting can update subcontractors"
  ON subcontractors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision', 'Accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Supervision', 'Accounting')
    )
  );

-- Update contracts policies to allow Accounting role
-- First check if the policies exist
DO $$
BEGIN
  -- Allow Accounting to INSERT contracts
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert contracts' AND tablename = 'contracts') THEN
    DROP POLICY "Authenticated users can insert contracts" ON contracts;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Directors and Supervision can insert contracts' AND tablename = 'contracts') THEN
    DROP POLICY "Directors and Supervision can insert contracts" ON contracts;
  END IF;

  CREATE POLICY "Directors, Supervision and Accounting can create contracts"
    ON contracts FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.auth_user_id = auth.uid()
        AND users.role IN ('Director', 'Supervision', 'Accounting')
      )
    );

  -- Allow Accounting to UPDATE contracts (for contracts they create)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Directors and Supervision can update contracts' AND tablename = 'contracts') THEN
    DROP POLICY "Directors and Supervision can update contracts" ON contracts;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update contracts' AND tablename = 'contracts') THEN
    DROP POLICY "Authenticated users can update contracts" ON contracts;
  END IF;

  CREATE POLICY "Directors, Supervision and Accounting can update contracts"
    ON contracts FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.auth_user_id = auth.uid()
        AND users.role IN ('Director', 'Supervision', 'Accounting')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.auth_user_id = auth.uid()
        AND users.role IN ('Director', 'Supervision', 'Accounting')
      )
    );
END $$;