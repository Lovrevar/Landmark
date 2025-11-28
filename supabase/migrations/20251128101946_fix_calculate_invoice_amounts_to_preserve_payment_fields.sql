/*
  # Fix Calculate Invoice Amounts to Preserve Payment Fields

  1. Problem
    - calculate_invoice_amounts trigger runs BEFORE UPDATE
    - It recalculates remaining_amount which overwrites values from payment trigger
    - This prevents invoice status from being updated correctly

  2. Solution
    - Modify function to only calculate amounts when base_amount or vat_rate changes
    - Don't touch paid_amount, remaining_amount, or status if they're being set by payment trigger
    - Use OLD values to detect if calculation is needed

  3. Changes
    - Update calculate_invoice_amounts function to be smarter
    - Only recalculate when base financial data changes
    - Preserve payment-related fields when they're updated
*/

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only recalculate vat_amount and total_amount if base_amount or vat_rate changed
  IF TG_OP = 'INSERT' OR 
     OLD.base_amount IS DISTINCT FROM NEW.base_amount OR 
     OLD.vat_rate IS DISTINCT FROM NEW.vat_rate THEN
    
    NEW.vat_amount := NEW.base_amount * (NEW.vat_rate / 100);
    NEW.total_amount := NEW.base_amount + NEW.vat_amount;
    
    -- Only set remaining_amount if this is an INSERT
    -- For UPDATE, let payment triggers handle it
    IF TG_OP = 'INSERT' THEN
      NEW.remaining_amount := NEW.total_amount;
      NEW.paid_amount := 0;
      NEW.status := 'UNPAID';
    END IF;
  END IF;
  
  -- For UPDATE, if paid_amount changed, recalculate remaining_amount
  -- This allows payment triggers to work correctly
  IF TG_OP = 'UPDATE' AND OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
    NEW.remaining_amount := NEW.total_amount - NEW.paid_amount;
  END IF;
  
  RETURN NEW;
END;
$$;
