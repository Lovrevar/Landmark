/*
  # Reset Paid Milestones Without Invoices

  ## Problem
  Some milestones are marked as 'paid' but have no accounting_invoices or payments
  linked to them. This happens when invoices are deleted directly without triggering
  the milestone status update.

  ## Solution
  Reset all milestones that are marked as 'paid' but have no PAID invoices linked to them.

  ## Changes
  - One-time fix to reset milestones with status 'paid' but no PAID invoices
*/

-- Reset milestones that are marked as 'paid' but have no PAID invoices
UPDATE subcontractor_milestones sm
SET 
  status = 'pending',
  paid_date = NULL
WHERE status = 'paid'
  AND NOT EXISTS (
    SELECT 1 
    FROM accounting_invoices ai
    WHERE ai.milestone_id = sm.id
      AND ai.status = 'PAID'
  );
