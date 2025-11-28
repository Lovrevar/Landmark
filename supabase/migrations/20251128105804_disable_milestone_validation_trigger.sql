/*
  # Disable Milestone Validation Trigger

  Problem: validate_milestone_payment_status_trigger checks if invoice is PAID
  BEFORE allowing milestone status to be set to 'paid'. But in the same transaction:
  1. Payment is inserted
  2. update_milestone_status_on_payment tries to set milestone to 'paid'
  3. validate_milestone_payment_status_trigger blocks it (invoice not yet PAID)
  4. update_invoice_payment_status sets invoice to PAID (too late)

  Solution: Drop this validation trigger completely. The logic in 
  update_milestone_status_on_payment already ensures milestones are only set to 
  'paid' when the full amount is paid.
*/

-- Drop the validation trigger
DROP TRIGGER IF EXISTS validate_milestone_payment_status_trigger ON subcontractor_milestones;

-- Drop the validation function (no longer needed)
DROP FUNCTION IF EXISTS validate_milestone_payment_status();
