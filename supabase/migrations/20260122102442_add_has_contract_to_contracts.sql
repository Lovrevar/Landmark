/*
  # Add has_contract field to contracts table

  1. Changes
    - Add `has_contract` boolean field to `contracts` table
    - Default value is `true` for existing contracts
    - When `has_contract = false`:
      - Subcontractor doesn't have a formal contract
      - contract_amount can be NULL or 0
      - Budget is tracked only through actual invoices/payments
      - Progress cannot be calculated

  2. Notes
    - Existing contracts are automatically marked as has_contract = true
    - This enables flexible tracking of subcontractors without formal contracts
*/

-- Add has_contract field to contracts table
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS has_contract boolean DEFAULT true NOT NULL;

-- Update existing contracts to have has_contract = true
UPDATE contracts SET has_contract = true WHERE has_contract IS NULL;

-- Add comment to explain the field
COMMENT ON COLUMN contracts.has_contract IS 
'Indicates if subcontractor has a formal contract. If false, contract_amount may be 0/NULL and budget is tracked via invoices only.';