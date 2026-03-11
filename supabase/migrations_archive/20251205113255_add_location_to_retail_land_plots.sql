/*
  # Add Location Field to Retail Land Plots

  1. Changes
    - Add `location` column to `retail_land_plots` table
      - Type: text (nullable)
      - Purpose: Store location/address information for land plots
  
  2. Notes
    - Field is optional (nullable) to allow existing records
    - No default value set
*/

-- Add location column to retail_land_plots table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_land_plots' AND column_name = 'location'
  ) THEN
    ALTER TABLE retail_land_plots ADD COLUMN location text;
  END IF;
END $$;
