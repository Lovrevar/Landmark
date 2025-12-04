/*
  # Add Surface Fields to Retail Contracts for Sales Phase

  ## Purpose
  Add surface area tracking and automatic price per m² calculation for retail sales contracts.

  ## Changes
  1. Add building_surface_m2 - površina objekta (building/retail space surface)
  2. Add total_surface_m2 - ukupna površina (total surface including parking, storage, etc.)
  3. Add price_per_m2 - cijena po m² (automatically calculated: contract_amount / total_surface_m2)

  ## Notes
  - These fields are primarily for sales phase (Phase 3) contracts
  - price_per_m2 will be calculated automatically when total_surface_m2 is provided
*/

-- Add building_surface_m2 column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contracts' AND column_name = 'building_surface_m2'
  ) THEN
    ALTER TABLE retail_contracts ADD COLUMN building_surface_m2 numeric(10,2);
  END IF;
END $$;

-- Add total_surface_m2 column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contracts' AND column_name = 'total_surface_m2'
  ) THEN
    ALTER TABLE retail_contracts ADD COLUMN total_surface_m2 numeric(10,2);
  END IF;
END $$;

-- Add price_per_m2 column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contracts' AND column_name = 'price_per_m2'
  ) THEN
    ALTER TABLE retail_contracts ADD COLUMN price_per_m2 numeric(10,2);
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN retail_contracts.building_surface_m2 IS 'Površina objekta/prostora u m² (building/retail space surface area)';
COMMENT ON COLUMN retail_contracts.total_surface_m2 IS 'Ukupna površina u m² (total surface including parking, storage, etc.)';
COMMENT ON COLUMN retail_contracts.price_per_m2 IS 'Cijena po m² (calculated: contract_amount / total_surface_m2)';
