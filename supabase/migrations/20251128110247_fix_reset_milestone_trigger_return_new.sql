/*
  # Fix reset_milestone_status_on_invoice_change to Return NEW

  Problem: The function returns OLD instead of NEW, which discards all 
  UPDATE changes to the invoice (paid_amount, status, remaining_amount).

  Solution: Return NEW so that the invoice updates are applied.
*/

CREATE OR REPLACE FUNCTION reset_milestone_status_on_invoice_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.milestone_id IS NOT NULL THEN
    UPDATE subcontractor_milestones
    SET status = 'pending',
        paid_date = NULL
    WHERE id = OLD.milestone_id
      AND NOT EXISTS (
        SELECT 1 
        FROM accounting_invoices 
        WHERE milestone_id = OLD.milestone_id 
          AND status = 'PAID'
          AND id != OLD.id
      );
  END IF;

  RETURN NEW;  -- Changed from OLD to NEW
END;
$$;

-- Fix all existing invoices with payments
UPDATE accounting_invoices ai
SET 
  paid_amount = subquery.total_paid,
  remaining_amount = ai.total_amount - subquery.total_paid,
  status = CASE
    WHEN subquery.total_paid = 0 THEN 'UNPAID'
    WHEN subquery.total_paid >= ai.total_amount THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END
FROM (
  SELECT 
    invoice_id,
    COALESCE(SUM(amount), 0) as total_paid
  FROM accounting_payments
  GROUP BY invoice_id
) subquery
WHERE ai.id = subquery.invoice_id;
