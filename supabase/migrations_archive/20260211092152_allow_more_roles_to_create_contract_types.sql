/*
  # Allow More Roles to Create Contract Types

  1. Changes
    - Update INSERT policy on `contract_types` to allow project managers and supervision users
    - Previously only directors and admins could create categories
    - Now project_manager, supervision, director, and admin can create categories
  
  2. Security
    - Still restricted to authenticated users with specific roles
    - Maintains data integrity while allowing more operational flexibility
*/

-- Update policy to allow more roles to insert contract types
DROP POLICY IF EXISTS "Directors can insert contract types" ON contract_types;
CREATE POLICY "Authenticated users can insert contract types"
  ON contract_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin', 'project_manager', 'supervision')
    )
  );

-- Update policy to allow more roles to update contract types
DROP POLICY IF EXISTS "Directors can update contract types" ON contract_types;
CREATE POLICY "Authenticated users can update contract types"
  ON contract_types
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin', 'project_manager', 'supervision')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin', 'project_manager', 'supervision')
    )
  );

-- Keep delete restricted to directors and admins only
DROP POLICY IF EXISTS "Directors can delete contract types" ON contract_types;
CREATE POLICY "Directors can delete contract types"
  ON contract_types
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('director', 'admin')
    )
  );
