/*
  # Add 5% VAT Rate Support to Accounting Invoices

  ## Summary
  This migration adds support for 5% VAT rate to accounting invoices, extending the existing
  VAT rates (25%, 13%, 0%) to include a fourth rate.

  ## Changes

  1. **New Columns Added to `accounting_invoices` table:**
     - `base_amount_4` (numeric) - Base amount for 5% VAT rate
     - `vat_rate_4` (numeric) - VAT rate (5%)
     - `vat_amount_4` (numeric) - Calculated VAT amount for 5% rate

  2. **Updated Trigger Function:**
     - Modified `calculate_invoice_amounts()` to include 5% VAT calculation
     - Formula: vat_amount_4 = base_amount_4 * 0.05
     - Total amount now includes the fourth VAT component

  3. **Security:**
     - No changes to RLS policies
     - Existing security model remains unchanged
*/

-- Step 1: Add new columns for 5% VAT rate
ALTER TABLE accounting_invoices
  ADD COLUMN IF NOT EXISTS base_amount_4 numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_rate_4 numeric DEFAULT 5 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_amount_4 numeric DEFAULT 0 NOT NULL;

-- Step 2: Drop old trigger first, then function
DROP TRIGGER IF EXISTS trigger_calculate_invoice_amounts ON accounting_invoices;
DROP FUNCTION IF EXISTS calculate_invoice_amounts() CASCADE;

-- Step 3: Create updated trigger function with 5% VAT rate support
CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate VAT amounts for each rate
  NEW.vat_amount_1 := ROUND(COALESCE(NEW.base_amount_1, 0) * 0.25, 2);
  NEW.vat_amount_2 := ROUND(COALESCE(NEW.base_amount_2, 0) * 0.13, 2);
  NEW.vat_amount_3 := 0; -- 0% VAT is always 0
  NEW.vat_amount_4 := ROUND(COALESCE(NEW.base_amount_4, 0) * 0.05, 2);

  -- Calculate total amount as sum of all four (base + VAT) amounts
  NEW.total_amount := 
    (COALESCE(NEW.base_amount_1, 0) + COALESCE(NEW.vat_amount_1, 0)) +
    (COALESCE(NEW.base_amount_2, 0) + COALESCE(NEW.vat_amount_2, 0)) +
    (COALESCE(NEW.base_amount_3, 0) + COALESCE(NEW.vat_amount_3, 0)) +
    (COALESCE(NEW.base_amount_4, 0) + COALESCE(NEW.vat_amount_4, 0));

  -- Update legacy fields for backward compatibility
  -- Set base_amount to sum of all base amounts
  NEW.base_amount := 
    COALESCE(NEW.base_amount_1, 0) + 
    COALESCE(NEW.base_amount_2, 0) + 
    COALESCE(NEW.base_amount_3, 0) +
    COALESCE(NEW.base_amount_4, 0);
  
  -- Set vat_amount to sum of all VAT amounts
  NEW.vat_amount := 
    COALESCE(NEW.vat_amount_1, 0) + 
    COALESCE(NEW.vat_amount_2, 0) + 
    COALESCE(NEW.vat_amount_3, 0) +
    COALESCE(NEW.vat_amount_4, 0);

  -- Calculate remaining amount
  NEW.remaining_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.paid_amount, 0);

  RETURN NEW;
END;
$$;

-- Step 4: Recreate trigger
CREATE TRIGGER trigger_calculate_invoice_amounts
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_amounts();

-- Step 5: Add helpful comments
COMMENT ON COLUMN accounting_invoices.base_amount_4 IS 'Base amount subject to 5% VAT rate';
COMMENT ON COLUMN accounting_invoices.vat_amount_4 IS 'Calculated VAT amount at 5% rate';
