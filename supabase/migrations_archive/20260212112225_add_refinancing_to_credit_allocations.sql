/*
  # Add Refinancing Support to Credit Allocations

  ## Summary
  Adds support for tracking credit allocation type and refinancing target entities.
  This allows users to allocate credit for refinancing existing loans from companies or banks.

  ## Changes Made
  1. New Columns
     - `allocation_type` - Type of allocation: 'project', 'opex', or 'refinancing'
     - `refinancing_entity_type` - Type of entity being refinanced: 'company' or 'bank'
     - `refinancing_entity_id` - UUID reference to the entity being refinanced

  2. Foreign Keys
     - When entity_type is 'company', references accounting_companies table
     - When entity_type is 'bank', references banks table

  3. Check Constraints
     - Ensure allocation_type is one of: 'project', 'opex', 'refinancing'
     - Ensure refinancing_entity_type is one of: 'company', 'bank'
     - When allocation_type = 'refinancing', refinancing_entity_type and refinancing_entity_id must be set
     - When allocation_type = 'project', project_id must be set
     - When allocation_type = 'opex', project_id must be null

  ## Notes
  - Existing records default to 'project' if project_id is set, otherwise 'opex'
  - Refinancing allocations track which company or bank debt is being refinanced
*/

-- Add new columns
ALTER TABLE credit_allocations
ADD COLUMN IF NOT EXISTS allocation_type TEXT DEFAULT 'project',
ADD COLUMN IF NOT EXISTS refinancing_entity_type TEXT,
ADD COLUMN IF NOT EXISTS refinancing_entity_id UUID;

-- Set allocation_type for existing records
UPDATE credit_allocations
SET allocation_type = CASE
  WHEN project_id IS NOT NULL THEN 'project'
  ELSE 'opex'
END
WHERE allocation_type = 'project';

-- Add check constraints
ALTER TABLE credit_allocations
DROP CONSTRAINT IF EXISTS credit_allocations_allocation_type_check;

ALTER TABLE credit_allocations
ADD CONSTRAINT credit_allocations_allocation_type_check
CHECK (allocation_type IN ('project', 'opex', 'refinancing'));

ALTER TABLE credit_allocations
DROP CONSTRAINT IF EXISTS credit_allocations_refinancing_entity_type_check;

ALTER TABLE credit_allocations
ADD CONSTRAINT credit_allocations_refinancing_entity_type_check
CHECK (
  refinancing_entity_type IS NULL OR
  refinancing_entity_type IN ('company', 'bank')
);

-- Add constraint to ensure proper fields are set based on allocation type
ALTER TABLE credit_allocations
DROP CONSTRAINT IF EXISTS credit_allocations_type_consistency_check;

ALTER TABLE credit_allocations
ADD CONSTRAINT credit_allocations_type_consistency_check
CHECK (
  (allocation_type = 'project' AND project_id IS NOT NULL AND refinancing_entity_id IS NULL) OR
  (allocation_type = 'opex' AND project_id IS NULL AND refinancing_entity_id IS NULL) OR
  (allocation_type = 'refinancing' AND refinancing_entity_type IS NOT NULL AND refinancing_entity_id IS NOT NULL AND project_id IS NULL)
);

-- Create indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_credit_allocations_refinancing_entity
ON credit_allocations(refinancing_entity_id, refinancing_entity_type);

-- Add foreign key reference to accounting_companies (checked via trigger since we have polymorphic relationship)
-- Note: PostgreSQL doesn't support conditional foreign keys, so we'll validate via application logic
-- and create a trigger to ensure referential integrity

-- Create function to validate refinancing entity references
CREATE OR REPLACE FUNCTION validate_refinancing_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.allocation_type = 'refinancing' THEN
    IF NEW.refinancing_entity_type = 'company' THEN
      IF NOT EXISTS (SELECT 1 FROM accounting_companies WHERE id = NEW.refinancing_entity_id) THEN
        RAISE EXCEPTION 'Referenced company does not exist';
      END IF;
    ELSIF NEW.refinancing_entity_type = 'bank' THEN
      IF NOT EXISTS (SELECT 1 FROM banks WHERE id = NEW.refinancing_entity_id) THEN
        RAISE EXCEPTION 'Referenced bank does not exist';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate references
DROP TRIGGER IF EXISTS validate_refinancing_entity_trigger ON credit_allocations;

CREATE TRIGGER validate_refinancing_entity_trigger
BEFORE INSERT OR UPDATE ON credit_allocations
FOR EACH ROW
EXECUTE FUNCTION validate_refinancing_entity();
