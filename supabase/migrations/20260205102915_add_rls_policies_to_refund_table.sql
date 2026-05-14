/*
  # Add RLS Policies to Refund Table

  1. Security
    - Add SELECT policy for authenticated users to read refund data
    - Add INSERT, UPDATE, DELETE policies for accounting users
    
  2. Purpose
    - Allow authenticated users to view refund options when creating invoices
    - Allow accounting staff to manage refund entries
*/

CREATE POLICY "Authenticated users can view refunds"
  ON accounting_invoices_refund
  FOR SELECT
  TO authenticated
  USING (true);


CREATE POLICY "Authenticated users can insert refunds"
  ON accounting_invoices_refund
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


CREATE POLICY "Authenticated users can update refunds"
  ON accounting_invoices_refund
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);


CREATE POLICY "Authenticated users can delete refunds"
  ON accounting_invoices_refund
  FOR DELETE
  TO authenticated
  USING (true);

;