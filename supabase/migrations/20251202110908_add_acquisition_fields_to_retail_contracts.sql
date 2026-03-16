/*
  # Add Acquisition Fields to Retail Contracts

  ## Purpose
  Add fields specific to land acquisition (Phase 1 - Stjecanje zemljišta):
  - land_area_m2: Area of land purchased in square meters
  - contract_date: Date when contract was signed

  These fields are optional and will only be used for acquisition phase contracts.

  ## Changes
  1. Add land_area_m2 column (nullable, for acquisition contracts)
  2. Add contract_date column (nullable, for all contracts but primarily acquisition)

  ## Security
  - No RLS changes needed (existing policies cover new columns)
*/

-- Add land area field for acquisition contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contracts' AND column_name = 'land_area_m2'
  ) THEN
    ALTER TABLE retail_contracts ADD COLUMN land_area_m2 numeric CHECK (land_area_m2 > 0);
  END IF;
END $$;

-- Add contract date field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contracts' AND column_name = 'contract_date'
  ) THEN
    ALTER TABLE retail_contracts ADD COLUMN contract_date date;
  END IF;
END $$;

-- Create index for contract_date for faster queries
CREATE INDEX IF NOT EXISTS idx_retail_contracts_contract_date ON retail_contracts(contract_date);

-- Add comment to clarify usage
COMMENT ON COLUMN retail_contracts.land_area_m2 IS 'Area of land in m² (used for acquisition phase contracts)';
COMMENT ON COLUMN retail_contracts.contract_date IS 'Date when contract was signed';
