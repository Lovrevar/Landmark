/*
  # Fix Contracts INSERT Policy for Supervision Users

  1. Problem
    - contracts table is missing INSERT policy
    - Supervision users (project managers) cannot add contracts/subcontractors
    - This breaks Site Management functionality

  2. Solution
    - Add INSERT policy that allows:
      - Directors to insert any contract
      - Supervision users to insert contracts for their assigned projects

  3. Security
    - Directors have full access
    - Supervision users can only add contracts to projects they manage
*/

-- Add INSERT policy for contracts table
CREATE POLICY "Allow authenticated to insert contracts"
ON contracts
FOR INSERT
TO authenticated
WITH CHECK (
  -- Directors can insert any contract
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = (SELECT auth.uid()) 
    AND role = 'Director'
  )
  OR
  -- Supervision users can insert contracts for their assigned projects
  EXISTS (
    SELECT 1 
    FROM project_managers pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.user_id = (SELECT auth.uid())
    AND pm.project_id = contracts.project_id
    AND u.role = 'Supervision'
  )
);
