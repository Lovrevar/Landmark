/*
  # Allow Postgres User to Update Invoice Status

  1. Problem
    - Trigger function runs as postgres user (SECURITY DEFINER)
    - RLS policies only allow authenticated users with specific roles
    - Postgres superuser updates are being blocked by RLS

  2. Solution
    - Add policy that allows postgres user to update invoices
    - This will enable trigger functions to work

  3. Changes
    - Create new RLS policy for system updates
*/

-- Add policy to allow postgres (system) updates
CREATE POLICY "System can update invoice status"
  ON accounting_invoices
  FOR UPDATE
  TO postgres
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions to postgres role
GRANT UPDATE ON accounting_invoices TO postgres;
GRANT SELECT ON accounting_invoices TO postgres;
GRANT SELECT ON accounting_payments TO postgres;
