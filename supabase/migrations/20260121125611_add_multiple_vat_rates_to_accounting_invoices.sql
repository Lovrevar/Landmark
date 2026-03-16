/*
  # Add Multiple VAT Rates Support to Accounting Invoices

  ## Summary
  This migration enables accounting invoices to support multiple VAT rates (25%, 13%, 0%) on a single invoice.
  Previously, each invoice could only have one base amount with one VAT rate. Now each invoice can have up to three
  different base amounts, each with its own VAT rate and VAT amount.

  ## Changes

  1. **New Columns Added to `accounting_invoices` table:**
     - `base_amount_1` (numeric) - Base amount for 25% VAT rate
     - `vat_rate_1` (numeric) - VAT rate (25%)
     - `vat_amount_1` (numeric) - Calculated VAT amount for 25% rate
     - `base_amount_2` (numeric) - Base amount for 13% VAT rate
     - `vat_rate_2` (numeric) - VAT rate (13%)
     - `vat_amount_2` (numeric) - Calculated VAT amount for 13% rate
     - `base_amount_3` (numeric) - Base amount for 0% VAT rate
     - `vat_rate_3` (numeric) - VAT rate (0%)
     - `vat_amount_3` (numeric) - Calculated VAT amount for 0% rate (always 0)

  2. **Updated Trigger Function `calculate_invoice_amounts()`:**
     - Now calculates three separate VAT amounts based on three base amounts
     - Total amount = sum of all three (base + VAT) amounts
     - Maintains backward compatibility by keeping old fields
     - Formula:
       * vat_amount_1 = base_amount_1 * 0.25
       * vat_amount_2 = base_amount_2 * 0.13
       * vat_amount_3 = base_amount_3 * 0 (always 0)
       * total_amount = (base_1 + vat_1) + (base_2 + vat_2) + (base_3 + vat_3)

  3. **Data Migration:**
     - Existing invoices are migrated to new structure
     - Old `base_amount` is moved to appropriate new field based on `vat_rate`
     - If vat_rate = 25 → base_amount_1 = base_amount
     - If vat_rate = 13 → base_amount_2 = base_amount
     - If vat_rate = 0 → base_amount_3 = base_amount
     - Other fields default to 0

  4. **Backward Compatibility:**
     - Old columns (`base_amount`, `vat_rate`, `vat_amount`) are kept for reference
     - New invoices should use the new fields exclusively
*/

-- Step 1: Add new columns to accounting_invoices table
ALTER TABLE accounting_invoices
  ADD COLUMN IF NOT EXISTS base_amount_1 numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_rate_1 numeric DEFAULT 25 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_amount_1 numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS base_amount_2 numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_rate_2 numeric DEFAULT 13 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_amount_2 numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS base_amount_3 numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_rate_3 numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_amount_3 numeric DEFAULT 0 NOT NULL;

-- Step 2: Migrate existing data to new structure
UPDATE accounting_invoices
SET 
  base_amount_1 = CASE WHEN vat_rate = 25 THEN base_amount ELSE 0 END,
  vat_amount_1 = CASE WHEN vat_rate = 25 THEN vat_amount ELSE 0 END,
  base_amount_2 = CASE WHEN vat_rate = 13 THEN base_amount ELSE 0 END,
  vat_amount_2 = CASE WHEN vat_rate = 13 THEN vat_amount ELSE 0 END,
  base_amount_3 = CASE WHEN vat_rate = 0 THEN base_amount ELSE 0 END,
  vat_amount_3 = 0
WHERE base_amount_1 = 0 AND base_amount_2 = 0 AND base_amount_3 = 0;

-- Step 3: Drop old trigger first, then function
DROP TRIGGER IF EXISTS calculate_invoice_amounts_trigger ON accounting_invoices;
DROP TRIGGER IF EXISTS trigger_calculate_invoice_amounts ON accounting_invoices;
DROP FUNCTION IF EXISTS calculate_invoice_amounts() CASCADE;

-- Step 4: Create updated trigger function with multiple VAT rates support
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

  -- Calculate total amount as sum of all three (base + VAT) amounts
  NEW.total_amount := 
    (COALESCE(NEW.base_amount_1, 0) + COALESCE(NEW.vat_amount_1, 0)) +
    (COALESCE(NEW.base_amount_2, 0) + COALESCE(NEW.vat_amount_2, 0)) +
    (COALESCE(NEW.base_amount_3, 0) + COALESCE(NEW.vat_amount_3, 0));

  -- Update legacy fields for backward compatibility
  -- Set base_amount to sum of all base amounts
  NEW.base_amount := 
    COALESCE(NEW.base_amount_1, 0) + 
    COALESCE(NEW.base_amount_2, 0) + 
    COALESCE(NEW.base_amount_3, 0);
  
  -- Set vat_amount to sum of all VAT amounts
  NEW.vat_amount := 
    COALESCE(NEW.vat_amount_1, 0) + 
    COALESCE(NEW.vat_amount_2, 0) + 
    COALESCE(NEW.vat_amount_3, 0);

  -- Calculate remaining amount
  NEW.remaining_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.paid_amount, 0);

  -- Preserve other payment-related fields that might be set by other triggers
  -- (cesija_payment_id, cesija_credit_id, bank_account_id remain unchanged)

  RETURN NEW;
END;
$$;

-- Step 5: Recreate trigger
CREATE TRIGGER trigger_calculate_invoice_amounts
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_amounts();

-- Step 6: Add helpful comments
COMMENT ON COLUMN accounting_invoices.base_amount_1 IS 'Base amount subject to 25% VAT rate';
COMMENT ON COLUMN accounting_invoices.base_amount_2 IS 'Base amount subject to 13% VAT rate';
COMMENT ON COLUMN accounting_invoices.base_amount_3 IS 'Base amount subject to 0% VAT rate';
COMMENT ON COLUMN accounting_invoices.vat_amount_1 IS 'Calculated VAT amount at 25% rate';
COMMENT ON COLUMN accounting_invoices.vat_amount_2 IS 'Calculated VAT amount at 13% rate';
COMMENT ON COLUMN accounting_invoices.vat_amount_3 IS 'Calculated VAT amount at 0% rate (always 0)';
