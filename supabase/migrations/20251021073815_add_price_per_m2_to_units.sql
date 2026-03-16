/*
  # Add price_per_m2 to apartments, garages, and repositories

  1. Changes
    - Add `price_per_m2` column to `apartments` table
    - Add `price_per_m2` column to `garages` table
    - Add `price_per_m2` column to `repositories` table
    - Calculate default price_per_m2 for existing records (price / size_m2)
    - Keep existing `price` column for backward compatibility

  2. Notes
    - For existing records with size_m2 > 0, calculate price_per_m2 = price / size_m2
    - For records with size_m2 = 0, set price_per_m2 = 0
    - New records should populate both price_per_m2 and price fields
*/

-- Add price_per_m2 column to apartments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'price_per_m2'
  ) THEN
    ALTER TABLE apartments ADD COLUMN price_per_m2 numeric DEFAULT 0;
  END IF;
END $$;

-- Add price_per_m2 column to garages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'price_per_m2'
  ) THEN
    ALTER TABLE garages ADD COLUMN price_per_m2 numeric DEFAULT 0;
  END IF;
END $$;

-- Add price_per_m2 column to repositories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repositories' AND column_name = 'price_per_m2'
  ) THEN
    ALTER TABLE repositories ADD COLUMN price_per_m2 numeric DEFAULT 0;
  END IF;
END $$;

-- Calculate price_per_m2 for existing apartments
UPDATE apartments
SET price_per_m2 = CASE
  WHEN size_m2 > 0 THEN ROUND(price / size_m2, 2)
  ELSE 0
END
WHERE price_per_m2 = 0;

-- Calculate price_per_m2 for existing garages
UPDATE garages
SET price_per_m2 = CASE
  WHEN size_m2 > 0 THEN ROUND(price / size_m2, 2)
  ELSE 0
END
WHERE price_per_m2 = 0;

-- Calculate price_per_m2 for existing repositories
UPDATE repositories
SET price_per_m2 = CASE
  WHEN size_m2 > 0 THEN ROUND(price / size_m2, 2)
  ELSE 0
END
WHERE price_per_m2 = 0;