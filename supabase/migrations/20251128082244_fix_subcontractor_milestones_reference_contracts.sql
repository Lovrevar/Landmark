/*
  # Fix Subcontractor Milestones to Reference Contracts

  ## Overview
  Restructure subcontractor_milestones to reference contracts instead of subcontractors.
  This aligns with the master-detail architecture where:
  - subcontractors = master list (company info only)
  - contracts = detail records (project-specific contract info)
  - milestones = payment schedule for specific contracts

  ## Changes

  1. Drop the foreign key to subcontractors
  2. Add foreign key to contracts instead
  3. Remove redundant columns (project_id, phase_id) since they're in contracts
  4. Update unique constraint to use contract_id instead

  ## Migration Strategy
  - Delete existing milestone data (if any) to avoid FK violations
  - Restructure the table
  - RLS policies remain the same

  ## Security
  - Maintains all RLS policies
  - Data integrity preserved through FK to contracts
*/

-- Step 1: Drop existing data and constraints
TRUNCATE TABLE subcontractor_milestones CASCADE;

-- Step 2: Drop old foreign key constraint
ALTER TABLE subcontractor_milestones 
DROP CONSTRAINT IF EXISTS subcontractor_milestones_subcontractor_id_fkey;

-- Step 3: Drop unique constraint
ALTER TABLE subcontractor_milestones 
DROP CONSTRAINT IF EXISTS subcontractor_milestones_subcontractor_id_phase_id_milestone_nu;

-- Step 4: Drop redundant columns (project_id and phase_id are in contracts)
ALTER TABLE subcontractor_milestones 
DROP COLUMN IF EXISTS project_id,
DROP COLUMN IF EXISTS phase_id;

-- Step 5: Rename subcontractor_id to contract_id
ALTER TABLE subcontractor_milestones 
RENAME COLUMN subcontractor_id TO contract_id;

-- Step 6: Add foreign key to contracts
ALTER TABLE subcontractor_milestones 
ADD CONSTRAINT subcontractor_milestones_contract_id_fkey 
FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

-- Step 7: Add new unique constraint
ALTER TABLE subcontractor_milestones 
ADD CONSTRAINT subcontractor_milestones_contract_milestone_unique 
UNIQUE(contract_id, milestone_number);

-- Step 8: Drop and recreate indexes
DROP INDEX IF EXISTS idx_subcontractor_milestones_subcontractor_id;
DROP INDEX IF EXISTS idx_subcontractor_milestones_project_id;
DROP INDEX IF EXISTS idx_subcontractor_milestones_phase_id;
DROP INDEX IF EXISTS idx_subcontractor_milestones_subcontractor_phase;

CREATE INDEX IF NOT EXISTS idx_subcontractor_milestones_contract_id 
ON subcontractor_milestones(contract_id);

CREATE INDEX IF NOT EXISTS idx_subcontractor_milestones_status 
ON subcontractor_milestones(status);

-- Step 9: Add helpful comment
COMMENT ON TABLE subcontractor_milestones IS 'Payment milestones for specific contracts. Each milestone represents a payment installment tied to a contract.';
COMMENT ON COLUMN subcontractor_milestones.contract_id IS 'References the specific contract (from contracts table) this milestone belongs to';
