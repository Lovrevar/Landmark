/*
  # Add Equity Type to Bank Credits

  ## Summary
  Adds 'equity' as an allowed value to the credit_type check constraint in bank_credits table.
  This allows the system to track equity investments alongside traditional credit facilities.

  ## Changes
  - Drop existing credit_type check constraint
  - Create new constraint that includes 'equity' as a valid credit type

  ## Valid Credit Types After Migration
  - term_loan
  - line_of_credit
  - construction_loan
  - bridge_loan
  - equity (NEW)
*/

-- Drop the existing constraint
ALTER TABLE bank_credits 
DROP CONSTRAINT IF EXISTS bank_credits_credit_type_check;

-- Add the new constraint with 'equity' included
ALTER TABLE bank_credits
ADD CONSTRAINT bank_credits_credit_type_check
CHECK (credit_type = ANY (ARRAY['term_loan'::text, 'line_of_credit'::text, 'construction_loan'::text, 'bridge_loan'::text, 'equity'::text]));
