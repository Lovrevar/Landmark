/*
  # Ultra Simple Calculate Invoice Amounts

  1. Problem
    - Current trigger somehow resets paid_amount to 0
    - Need absolute minimal logic

  2. Solution
    - Only calculate VAT and total
    - Only set remaining_amount to satisfy constraint
    - NEVER touch paid_amount or status except on INSERT initialization

  3. Changes
    - Simplest possible trigger function
*/

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always calculate VAT and total
  NEW.vat_amount := NEW.base_amount * (NEW.vat_rate / 100);
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  
  -- Always calculate remaining_amount to satisfy constraint
  NEW.remaining_amount := NEW.total_amount - COALESCE(NEW.paid_amount, 0);
  
  -- ONLY on INSERT, set default values
  IF TG_OP = 'INSERT' THEN
    IF NEW.paid_amount IS NULL THEN
      NEW.paid_amount := 0;
    END IF;
    IF NEW.status IS NULL THEN
      NEW.status := 'UNPAID';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Test it
UPDATE accounting_invoices
SET paid_amount = 375000.00, status = 'PAID'
WHERE invoice_number = 'test';
