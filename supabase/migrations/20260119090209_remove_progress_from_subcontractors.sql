/*
  # Remove progress column from subcontractors table
  
  1. Changes
    - Drop the `progress` column from `subcontractors` table
    - Progress tracking belongs to individual contracts, not to subcontractors themselves
  
  2. Rationale
    - A subcontractor can have multiple contracts with different progress levels
    - Progress should be tracked at the contract level, not at the subcontractor level
*/

ALTER TABLE subcontractors DROP COLUMN IF EXISTS progress;
