/*
  # Fix Contract Types RLS - Case Insensitive Role Check

  1. Changes
    - Update all contract_types policies to use LOWER() for case-insensitive role comparison
    - Fixes issue where 'Director' (capital D) was not matching 'director' check
  
  2. Security
    - Maintains same security model, just fixes case sensitivity issue
*/

-- Fix INSERT policy with case-insensitive role check
DROP POLICY IF EXISTS "Authenticated users can insert contract types" ON contract_types;
CREATE POLICY "Authenticated users can insert contract types"
  ON contract_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND LOWER(users.role) IN ('director', 'admin', 'project_manager', 'supervision')
    )
  );

-- Fix UPDATE policy with case-insensitive role check
DROP POLICY IF EXISTS "Authenticated users can update contract types" ON contract_types;
CREATE POLICY "Authenticated users can update contract types"
  ON contract_types
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND LOWER(users.role) IN ('director', 'admin', 'project_manager', 'supervision')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND LOWER(users.role) IN ('director', 'admin', 'project_manager', 'supervision')
    )
  );

-- Fix DELETE policy with case-insensitive role check
DROP POLICY IF EXISTS "Directors can delete contract types" ON contract_types;
CREATE POLICY "Directors can delete contract types"
  ON contract_types
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND LOWER(users.role) IN ('director', 'admin')
    )
  );
