/*
  # Add VAT fields to contracts table

  1. Schema Changes
    - Add `base_amount` column (Osnovica - base amount before VAT)
    - Add `vat_rate` column (PDV stopa - VAT rate percentage: 0, 5, 13, 25)
    - Add `vat_amount` column (PDV iznos - calculated VAT amount)
    - Add `total_amount` column (Ukupno - base + VAT, replaces contract_amount)

  2. Data Migration
    - Set all existing contracts to 0% VAT
    - base_amount = contract_amount
    - vat_rate = 0
    - vat_amount = 0
    - total_amount = contract_amount

  3. Notes
    - Keeping contract_amount for backward compatibility initially
    - New UI will use base_amount, vat_rate, vat_amount, and total_amount
*/

-- Add new columns
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS base_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0 CHECK (vat_rate IN (0, 5, 13, 25)),
ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

-- Migrate existing data (set all to 0% VAT)
UPDATE contracts
SET 
  base_amount = contract_amount,
  vat_rate = 0,
  vat_amount = 0,
  total_amount = contract_amount
WHERE base_amount IS NULL OR base_amount = 0;

-- Create function to automatically calculate VAT amount and total
CREATE OR REPLACE FUNCTION calculate_contract_vat()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate VAT amount based on base amount and rate
  NEW.vat_amount := ROUND(NEW.base_amount * NEW.vat_rate / 100, 2);
  
  -- Calculate total amount
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  
  -- Keep contract_amount in sync with total_amount for backward compatibility
  NEW.contract_amount := NEW.total_amount;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Create trigger to calculate VAT on insert/update
DROP TRIGGER IF EXISTS calculate_contract_vat_trigger ON contracts;
CREATE TRIGGER calculate_contract_vat_trigger
  BEFORE INSERT OR UPDATE OF base_amount, vat_rate
  ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_contract_vat();