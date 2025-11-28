/*
  # Fix calculate_invoice_amounts to Preserve Payment Fields

  ## Problem
  The `calculate_invoice_amounts` trigger function resets `paid_amount` and `status`
  on EVERY UPDATE of accounting_invoices, even when these fields should be managed
  by the `update_invoice_payment_status` trigger from accounting_payments.

  This causes a conflict:
  1. User adds a payment → update_invoice_payment_status sets paid_amount and status
  2. Any update to invoice (even unrelated) → calculate_invoice_amounts resets them!

  ## Solution
  Modify `calculate_invoice_amounts` to:
  - Only calculate VAT and total amounts (its original purpose)
  - Only calculate remaining_amount based on existing paid_amount
  - NEVER touch paid_amount (managed by payments trigger)
  - NEVER touch status (managed by payments trigger)

  ## Safety
  - Preserves all existing data
  - Only fixes trigger logic
  - Payment status will now work correctly
*/

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate VAT amount
  NEW.vat_amount := ROUND(NEW.base_amount * (NEW.vat_rate / 100), 2);

  -- Calculate total amount
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;

  -- Calculate remaining_amount based on EXISTING paid_amount
  -- DO NOT modify paid_amount here - it's managed by payment triggers
  NEW.remaining_amount := NEW.total_amount - NEW.paid_amount;

  -- DO NOT modify status here - it's managed by payment triggers
  -- Status is set by update_invoice_payment_status() when payments change

  -- Update timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- No need to recreate trigger, just updated the function
