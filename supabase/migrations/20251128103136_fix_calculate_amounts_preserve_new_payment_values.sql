/*
  # Fix Calculate Invoice Amounts - Preserve NEW Payment Values

  1. Problem
    - BEFORE UPDATE trigger overwrites NEW.paid_amount and NEW.status
    - When UPDATE sets paid_amount = 375000, trigger resets it to 0
    - Trigger must preserve values set by UPDATE statement

  2. Solution
    - Only recalculate amounts when base_amount or vat_rate changes
    - For payment fields, preserve NEW values (don't overwrite them)
    - Always maintain remaining_amount = total_amount - paid_amount for constraint

  3. Changes
    - Check if base_amount or vat_rate changed before recalculating
    - Preserve NEW.paid_amount and NEW.status if they're being updated
*/

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Calculate VAT and total if base values changed
  IF TG_OP = 'INSERT' OR 
     OLD.base_amount IS DISTINCT FROM NEW.base_amount OR 
     OLD.vat_rate IS DISTINCT FROM NEW.vat_rate THEN
    NEW.vat_amount := NEW.base_amount * (NEW.vat_rate / 100);
    NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  END IF;
  
  -- Always maintain the check constraint: remaining_amount = total_amount - paid_amount
  NEW.remaining_amount := NEW.total_amount - COALESCE(NEW.paid_amount, 0);
  
  -- On INSERT, initialize payment fields
  IF TG_OP = 'INSERT' THEN
    NEW.paid_amount := COALESCE(NEW.paid_amount, 0);
    NEW.status := COALESCE(NEW.status, 'UNPAID');
  END IF;
  
  -- On UPDATE, preserve NEW.paid_amount and NEW.status (don't reset them)
  -- They are already set by the UPDATE statement or by payment trigger
  
  RETURN NEW;
END;
$$;

-- Test the fix by updating the test invoice
UPDATE accounting_invoices
SET 
  paid_amount = 375000.00,
  status = 'PAID'
WHERE invoice_number = 'test';
