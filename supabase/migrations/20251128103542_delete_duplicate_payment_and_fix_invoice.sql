/*
  # Delete Duplicate Payment and Fix Invoice

  1. Problem
    - Two payments exist for the same invoice (375,000 total)
    - Invoice is only for 187,500
    - Need to delete one payment

  2. Solution
    - Delete one duplicate payment
    - Trigger should then update invoice automatically
    - If not, manually fix it

  3. Changes
    - Delete the second payment
    - Re-enable all triggers
    - Update invoice with correct amount
*/

-- Delete one of the duplicate payments (keep the first one)
DELETE FROM accounting_payments 
WHERE invoice_id = 'f85528ff-f872-467a-a23a-8114db470130'
  AND id = '533504bf-97b7-41b3-bf04-ce58009cc10a';

-- Re-enable triggers that were disabled
ALTER TABLE accounting_invoices ENABLE TRIGGER reset_milestone_status_on_invoice_change_trigger;
ALTER TABLE accounting_invoices ENABLE TRIGGER set_invoice_category_trigger;

-- Now trigger the payment status update by updating the remaining payment
UPDATE accounting_payments
SET updated_at = NOW()
WHERE invoice_id = 'f85528ff-f872-467a-a23a-8114db470130';
