/*
  # Add Retail Access to Accounting Invoices and Payments

  ## Problem
  Retail users cannot view their invoices and payments because RLS policies
  only allow Director, Accounting, and Supervision roles.

  ## Solution
  Add RLS policies for Retail users to:
  1. View invoices related to their retail contracts (via retail_contract_id)
  2. View payments for their retail invoices

  ## Changes
  - Add SELECT policy for Retail users on accounting_invoices
  - Add SELECT policy for Retail users on accounting_payments
*/

-- Policy for Retail users to view their retail invoices
CREATE POLICY "Retail can view retail invoices"
  ON accounting_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'Retail'
    )
    AND invoice_category = 'RETAIL'
    AND retail_contract_id IS NOT NULL
  );

-- Policy for Retail users to view payments for retail invoices
CREATE POLICY "Retail can view payments for retail invoices"
  ON accounting_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'Retail'
    )
    AND EXISTS (
      SELECT 1 FROM accounting_invoices ai
      WHERE ai.id = accounting_payments.invoice_id
        AND ai.invoice_category = 'RETAIL'
        AND ai.retail_contract_id IS NOT NULL
    )
  );
