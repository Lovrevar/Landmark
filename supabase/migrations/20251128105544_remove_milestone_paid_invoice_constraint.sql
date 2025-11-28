/*
  # Remove Milestone Paid Invoice Constraint

  Problem: The constraint checks if invoice is PAID before allowing payment,
  but the invoice status is updated AFTER the payment is inserted.

  Solution: Remove this constraint - the trigger chain will handle everything correctly:
  1. Payment is inserted
  2. update_invoice_payment_status trigger updates invoice to PAID
  3. Milestone status is already set correctly
*/

-- Drop the trigger that enforces this constraint
DROP TRIGGER IF EXISTS check_milestone_paid_invoice_trigger ON subcontractor_milestones;

-- Drop the function
DROP FUNCTION IF EXISTS check_milestone_paid_invoice();
