/*
  # Update Retail Contract Milestones for Percentage-Based Model

  ## Purpose
  Change retail_contract_milestones from customer-based to percentage-based model like Site Management.
  This allows splitting contracts by percentage (e.g., 40% for Lidl, 30% for Kaufland, 30% for Spar).

  ## Changes
  1. Remove customer_id column (not needed for milestone tracking)
  2. Replace amount with percentage column
  3. Add milestone_number for ordering
  4. Add description column for details
  5. Update status check constraint

  ## Security
  - RLS policies will be maintained through existing contract policies
*/

-- Add new columns
DO $$
BEGIN
  -- Add milestone_number if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contract_milestones' AND column_name = 'milestone_number'
  ) THEN
    ALTER TABLE retail_contract_milestones ADD COLUMN milestone_number integer NOT NULL DEFAULT 1;
  END IF;

  -- Add percentage if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contract_milestones' AND column_name = 'percentage'
  ) THEN
    ALTER TABLE retail_contract_milestones ADD COLUMN percentage numeric NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100);
  END IF;

  -- Add description if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contract_milestones' AND column_name = 'description'
  ) THEN
    ALTER TABLE retail_contract_milestones ADD COLUMN description text DEFAULT '';
  END IF;
END $$;

-- Drop customer_id column if it exists (we don't need it for percentage-based milestones)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contract_milestones' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE retail_contract_milestones DROP COLUMN customer_id;
  END IF;
END $$;

-- Drop amount column if it exists (we'll use percentage instead)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contract_milestones' AND column_name = 'amount'
  ) THEN
    ALTER TABLE retail_contract_milestones DROP COLUMN amount;
  END IF;
END $$;

-- Update status constraint to match Site Management
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'retail_contract_milestones_status_check'
  ) THEN
    ALTER TABLE retail_contract_milestones DROP CONSTRAINT retail_contract_milestones_status_check;
  END IF;

  -- Add new constraint
  ALTER TABLE retail_contract_milestones 
    ADD CONSTRAINT retail_contract_milestones_status_check 
    CHECK (status IN ('pending', 'paid', 'cancelled'));
END $$;

-- Create index for milestone_number
CREATE INDEX IF NOT EXISTS idx_retail_contract_milestones_milestone_number 
  ON retail_contract_milestones(contract_id, milestone_number);

-- Add comments
COMMENT ON COLUMN retail_contract_milestones.milestone_number IS 'Sequential number for ordering milestones';
COMMENT ON COLUMN retail_contract_milestones.percentage IS 'Percentage of contract amount (0-100)';
COMMENT ON COLUMN retail_contract_milestones.description IS 'Description of milestone deliverables';
