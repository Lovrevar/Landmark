/*
  # Fix Accounting Invoices DELETE Policy

  ## Problem
  The DELETE policy on accounting_invoices uses wrong column:
  - Current: users.id = auth.uid()
  - Correct: users.auth_user_id = auth.uid()

  This prevents Directors from deleting invoices through the UI.

  ## Solution
  Drop and recreate the DELETE policy with correct column reference.

  ## Safety
  - Only fixes RLS policy
  - Does not touch data
  - Does not modify table structure
*/

-- Drop the broken policy
DROP POLICY IF EXISTS "Director can delete invoices" ON accounting_invoices;

-- Recreate with correct column reference
CREATE POLICY "Director can delete invoices"
  ON accounting_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );
