/*
  # Add Separate Repayment Types for Principal and Interest
  
  1. Changes to company_credits
    - Add `principal_repayment_type` - how often principal is repaid (monthly, quarterly, biyearly, yearly)
    - Add `interest_repayment_type` - how often interest is repaid (monthly, quarterly, biyearly, yearly)
  
  2. Notes
    - This allows flexible repayment schedules where:
      - Principal can be repaid on one schedule (e.g., yearly)
      - Interest can be repaid on a different schedule (e.g., monthly)
    - Grace period still applies - no payments during grace period
    - Existing credits will default both types to 'yearly'
*/

-- Add repayment type columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credits' AND column_name = 'principal_repayment_type'
  ) THEN
    ALTER TABLE company_credits ADD COLUMN principal_repayment_type text DEFAULT 'yearly' 
      CHECK (principal_repayment_type IN ('monthly', 'quarterly', 'biyearly', 'yearly'));

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credits' AND column_name = 'interest_repayment_type'
  ) THEN
    ALTER TABLE company_credits ADD COLUMN interest_repayment_type text DEFAULT 'yearly' 
      CHECK (interest_repayment_type IN ('monthly', 'quarterly', 'biyearly', 'yearly'));

  END IF;

END $$;
;