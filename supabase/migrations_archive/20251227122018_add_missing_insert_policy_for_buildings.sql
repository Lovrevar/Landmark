/*
  # Add Missing INSERT Policy for Buildings Table
  
  1. Problem
    - Buildings table has SELECT, UPDATE, DELETE policies but missing INSERT policy
    - Users cannot create new buildings due to RLS violation
  
  2. Solution
    - Add INSERT policy for authenticated users
    - Allow all authenticated users to insert buildings
  
  3. Security
    - Policy uses authenticated role check
    - Consistent with existing policies on this table
*/

-- Add missing INSERT policy for buildings
CREATE POLICY "Allow authenticated to insert buildings"
  ON buildings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
