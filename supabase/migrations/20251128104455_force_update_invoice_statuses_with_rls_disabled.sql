/*
  # Force Update Invoice Statuses with RLS Disabled

  Update all invoices to correct status by:
  1. Disabling user-defined triggers temporarily
  2. Disabling RLS
  3. Direct UPDATE
  4. Re-enabling everything
*/

-- Disable user triggers (not system triggers)
ALTER TABLE accounting_invoices DISABLE TRIGGER z_calculate_invoice_amounts_trigger;
ALTER TABLE accounting_invoices DISABLE TRIGGER reset_milestone_status_on_invoice_change_trigger;
ALTER TABLE accounting_invoices DISABLE TRIGGER set_invoice_category_trigger;

-- Disable RLS
ALTER TABLE accounting_invoices DISABLE ROW LEVEL SECURITY;

-- Direct update all invoices with payments
UPDATE accounting_invoices ai
SET 
  paid_amount = subquery.total_paid,
  remaining_amount = ai.total_amount - subquery.total_paid,
  status = CASE
    WHEN subquery.total_paid = 0 THEN 'UNPAID'
    WHEN subquery.total_paid >= ai.total_amount THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END,
  updated_at = NOW()
FROM (
  SELECT 
    invoice_id,
    COALESCE(SUM(amount), 0) as total_paid
  FROM accounting_payments
  GROUP BY invoice_id
) subquery
WHERE ai.id = subquery.invoice_id;

-- Re-enable RLS
ALTER TABLE accounting_invoices ENABLE ROW LEVEL SECURITY;

-- Re-enable triggers
ALTER TABLE accounting_invoices ENABLE TRIGGER z_calculate_invoice_amounts_trigger;
ALTER TABLE accounting_invoices ENABLE TRIGGER reset_milestone_status_on_invoice_change_trigger;
ALTER TABLE accounting_invoices ENABLE TRIGGER set_invoice_category_trigger;
