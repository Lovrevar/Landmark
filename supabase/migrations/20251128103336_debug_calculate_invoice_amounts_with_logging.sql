/*
  # Debug Calculate Invoice Amounts with Logging

  Add extensive logging to see what's happening
*/

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE WARNING 'Trigger START - TG_OP: %, Invoice: %', TG_OP, NEW.invoice_number;
  RAISE WARNING 'NEW.paid_amount BEFORE: %', NEW.paid_amount;
  RAISE WARNING 'NEW.status BEFORE: %', NEW.status;
  
  -- Calculate VAT and total
  NEW.vat_amount := NEW.base_amount * (NEW.vat_rate / 100);
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  
  RAISE WARNING 'NEW.total_amount: %', NEW.total_amount;
  
  -- Calculate remaining_amount
  NEW.remaining_amount := NEW.total_amount - COALESCE(NEW.paid_amount, 0);
  
  RAISE WARNING 'NEW.remaining_amount: %', NEW.remaining_amount;
  
  -- Only on INSERT
  IF TG_OP = 'INSERT' THEN
    RAISE WARNING 'INSERT detected - initializing defaults';
    IF NEW.paid_amount IS NULL THEN
      NEW.paid_amount := 0;
      RAISE WARNING 'Set paid_amount to 0';
    END IF;
    IF NEW.status IS NULL THEN
      NEW.status := 'UNPAID';
      RAISE WARNING 'Set status to UNPAID';
    END IF;
  ELSE
    RAISE WARNING 'UPDATE detected - NOT touching paid_amount or status';
  END IF;
  
  RAISE WARNING 'NEW.paid_amount AFTER: %', NEW.paid_amount;
  RAISE WARNING 'NEW.status AFTER: %', NEW.status;
  RAISE WARNING 'Trigger END';
  
  RETURN NEW;
END;
$$;
