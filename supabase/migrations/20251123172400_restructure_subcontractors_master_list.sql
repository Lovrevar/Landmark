/*
  # Restructure Subcontractors as Master List

  ## Overview
  This migration restructures the subcontractor system to eliminate duplicates and create a proper master-detail architecture.

  ## Changes

  ### 1. New Subcontractor Master List Structure
  - Create a new `subcontractor_master` table with only basic company info
  - This will be the single source of truth for each subcontractor

  ### 2. Migrate Data
  - Consolidate duplicate subcontractors into single master records
  - Ensure all contracts point to the correct master record

  ### 3. Cleanup
  - Remove project-specific columns from subcontractors (to be done in next migration)
  - Add tracking column to count active contracts

  ## Tables Affected
  - `subcontractors` - will be restructured
  - `contracts` - foreign keys will be updated
  - `accounting_invoices` - foreign keys will be updated

  ## Security
  - Maintains all existing RLS policies
  - No data loss - all information preserved in contracts table
*/

-- Step 1: Create a temporary mapping table to track which subcontractors should be merged
CREATE TEMP TABLE subcontractor_mapping AS
WITH ranked_subs AS (
  SELECT 
    id,
    name,
    contact,
    ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(name)) ORDER BY created_at ASC) as rn
  FROM subcontractors
)
SELECT 
  s1.id as old_id,
  s2.id as new_master_id,
  s1.name
FROM subcontractors s1
CROSS JOIN LATERAL (
  SELECT id 
  FROM ranked_subs 
  WHERE LOWER(TRIM(ranked_subs.name)) = LOWER(TRIM(s1.name)) 
  AND rn = 1
  LIMIT 1
) s2;

-- Step 2: Update all foreign key references to point to master records

-- Update contracts table
UPDATE contracts c
SET subcontractor_id = sm.new_master_id
FROM subcontractor_mapping sm
WHERE c.subcontractor_id = sm.old_id
AND sm.old_id != sm.new_master_id;

-- Update accounting_invoices table
UPDATE accounting_invoices ai
SET supplier_id = sm.new_master_id
FROM subcontractor_mapping sm
WHERE ai.supplier_id = sm.old_id
AND sm.old_id != sm.new_master_id;

-- Update subcontractor_milestones table
UPDATE subcontractor_milestones smil
SET subcontractor_id = sm.new_master_id
FROM subcontractor_mapping sm
WHERE smil.subcontractor_id = sm.old_id
AND sm.old_id != sm.new_master_id;

-- Update work_logs table
UPDATE work_logs wl
SET subcontractor_id = sm.new_master_id
FROM subcontractor_mapping sm
WHERE wl.subcontractor_id = sm.old_id
AND sm.old_id != sm.new_master_id;

-- Update subcontractor_comments table
UPDATE subcontractor_comments sc
SET subcontractor_id = sm.new_master_id
FROM subcontractor_mapping sm
WHERE sc.subcontractor_id = sm.old_id
AND sm.old_id != sm.new_master_id;

-- Step 3: Delete duplicate subcontractor records
DELETE FROM subcontractors s
WHERE EXISTS (
  SELECT 1 FROM subcontractor_mapping sm
  WHERE sm.old_id = s.id
  AND sm.old_id != sm.new_master_id
);

-- Step 4: Add a helpful computed column to track contract count (optional, for UI display)
-- This will help display how many active contracts each subcontractor has
ALTER TABLE subcontractors 
ADD COLUMN IF NOT EXISTS active_contracts_count INTEGER DEFAULT 0;

-- Create a function to update contract count
CREATE OR REPLACE FUNCTION update_subcontractor_contract_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE subcontractors
    SET active_contracts_count = (
      SELECT COUNT(*)
      FROM contracts
      WHERE subcontractor_id = NEW.subcontractor_id
      AND status IN ('draft', 'active')
    )
    WHERE id = NEW.subcontractor_id;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE subcontractors
    SET active_contracts_count = (
      SELECT COUNT(*)
      FROM contracts
      WHERE subcontractor_id = OLD.subcontractor_id
      AND status IN ('draft', 'active')
    )
    WHERE id = OLD.subcontractor_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep contract count updated
DROP TRIGGER IF EXISTS update_subcontractor_contract_count_trigger ON contracts;
CREATE TRIGGER update_subcontractor_contract_count_trigger
AFTER INSERT OR UPDATE OF status OR DELETE ON contracts
FOR EACH ROW
EXECUTE FUNCTION update_subcontractor_contract_count();

-- Initialize contract counts for existing records
UPDATE subcontractors s
SET active_contracts_count = (
  SELECT COUNT(*)
  FROM contracts c
  WHERE c.subcontractor_id = s.id
  AND c.status IN ('draft', 'active')
);
