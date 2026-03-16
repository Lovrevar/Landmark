/*
  # Add Extra Fields to Apartments Table

  ## Summary
  Adds five new columns to the apartments table to capture additional
  apartment specification data imported from Excel ("Tablica stanova"):

  ## New Columns
  - `ulaz` (text, nullable) - Building entrance/entry identifier (e.g., "A", "1")
  - `tip_stana` (text, nullable) - Apartment type classification string
  - `sobnost` (integer, nullable) - Number of rooms (e.g., 2, 3, 4)
  - `povrsina_otvoreno` (numeric, nullable) - Open/exterior area in m² (balcony, terrace, loggia)
  - `povrsina_ot_sa_koef` (numeric, nullable) - Open area with applied coefficient in m²

  ## Notes
  - All columns are nullable to remain backwards-compatible with existing records
  - No triggers are affected by these new columns
  - Existing RLS policies remain unchanged
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'ulaz'
  ) THEN
    ALTER TABLE apartments ADD COLUMN ulaz text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'tip_stana'
  ) THEN
    ALTER TABLE apartments ADD COLUMN tip_stana text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'sobnost'
  ) THEN
    ALTER TABLE apartments ADD COLUMN sobnost integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'povrsina_otvoreno'
  ) THEN
    ALTER TABLE apartments ADD COLUMN povrsina_otvoreno numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'povrsina_ot_sa_koef'
  ) THEN
    ALTER TABLE apartments ADD COLUMN povrsina_ot_sa_koef numeric;
  END IF;
END $$;
