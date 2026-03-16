/*
  # Add Separate Repayment Types for Principal and Interest to Bank Credits
  
  1. Changes to bank_credits
    - Add `principal_repayment_type` - how often principal is repaid (monthly, quarterly, biyearly, yearly)
    - Add `interest_repayment_type` - how often interest is repaid (monthly, quarterly, biyearly, yearly)
  
  2. Notes
    - This allows flexible repayment schedules where:
      - Principal can be repaid on one schedule (e.g., yearly)
      - Interest can be repaid on a different schedule (e.g., monthly)
    - Grace period still applies - no payments during grace period
    - Existing credits will default both types to match existing repayment_type (monthly or yearly)
*/

-- Add repayment type columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'principal_repayment_type'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN principal_repayment_type text 
      CHECK (principal_repayment_type IN ('monthly', 'quarterly', 'biyearly', 'yearly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'interest_repayment_type'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN interest_repayment_type text 
      CHECK (interest_repayment_type IN ('monthly', 'quarterly', 'biyearly', 'yearly'));
  END IF;
END $$;

-- Update existing records to match their current repayment_type
UPDATE bank_credits 
SET 
  principal_repayment_type = repayment_type,
  interest_repayment_type = repayment_type
WHERE principal_repayment_type IS NULL OR interest_repayment_type IS NULL;