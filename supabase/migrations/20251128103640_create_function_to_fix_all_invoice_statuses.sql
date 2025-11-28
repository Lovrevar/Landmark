/*
  # Create Function to Fix All Invoice Statuses

  Since migrations don't persist UPDATE statements, create a function
  that can be called to fix invoice statuses
*/

-- Create function that fixes all invoices
CREATE OR REPLACE FUNCTION fix_all_invoice_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Disable RLS temporarily
  ALTER TABLE accounting_invoices DISABLE ROW LEVEL SECURITY;
  
  -- Fix all invoices that have payments
  UPDATE accounting_invoices ai
  SET 
    paid_amount = COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0),
    status = CASE
      WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0) = 0 THEN 'UNPAID'
      WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0) >= ai.total_amount THEN 'PAID'
      ELSE 'PARTIALLY_PAID'
    END,
    remaining_amount = ai.total_amount - COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0);
  
  -- Re-enable RLS
  ALTER TABLE accounting_invoices ENABLE ROW LEVEL SECURITY;
END;
$$;

-- Execute the function
SELECT fix_all_invoice_statuses();
