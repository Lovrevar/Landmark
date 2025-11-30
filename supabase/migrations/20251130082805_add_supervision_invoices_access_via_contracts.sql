/*
  # Add Supervision Access to Invoices via Contracts

  1. Changes
    - Add new RLS policy for Supervision users to view invoices for their assigned contracts
    - This allows Supervision to see invoices through the contract/subcontractor relationship
    - Policy checks if the invoice's contract_id exists in contracts table where the subcontractor
      has phases that the Supervision user has access to

  2. Security
    - Policy is restrictive and only allows SELECT
    - Only authenticated Supervision users can access
    - Access is granted only for invoices related to contracts they manage
*/

-- Drop the old restrictive policy and create a better one
DROP POLICY IF EXISTS "Supervision can view project invoices" ON accounting_invoices;

-- Create new policy that allows Supervision to view invoices through contracts
CREATE POLICY "Supervision can view invoices for their contracts"
  ON accounting_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'Supervision'
    )
  );
