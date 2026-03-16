/*
  # Add has_contract field to retail_contracts table

  1. Changes
    - Add `has_contract` boolean field to `retail_contracts` table
    - Default to `true` for backward compatibility
    - Similar to supervision contracts functionality

  2. Business Logic
    - When `has_contract = false`:
      - Contract amount can be 0
      - No invoices required
      - Used for tracking suppliers without formal contracts

  3. Security
    - No RLS changes needed - inherits existing policies

  4. Migration Safety
    - Uses IF NOT EXISTS to be idempotent
    - Existing contracts are automatically marked as has_contract = true
*/

-- Add has_contract field to retail_contracts table
ALTER TABLE retail_contracts
ADD COLUMN IF NOT EXISTS has_contract boolean DEFAULT true NOT NULL;

-- Update existing contracts to have has_contract = true
UPDATE retail_contracts SET has_contract = true WHERE has_contract IS NULL;

-- Add comment to document the field
COMMENT ON COLUMN retail_contracts.has_contract IS 
  'Indicates whether this is a formal contract (true) or just tracking without contract (false). When false, contract_amount can be 0 and no invoices are required.';
