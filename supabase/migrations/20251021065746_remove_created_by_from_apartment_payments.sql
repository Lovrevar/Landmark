/*
  # Remove created_by Column from apartment_payments
  
  ## Summary
  Removes the created_by column from apartment_payments table as it's not needed
  for tracking apartment payments.
  
  ## Changes Made
  1. Drop the foreign key constraint on created_by
  2. Drop the index on created_by
  3. Drop the created_by column
  
  ## Important Notes
  - This simplifies the apartment_payments table
  - Payment tracking doesn't require user attribution
*/

-- Drop foreign key constraint
ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_created_by_fkey;

-- Drop index
DROP INDEX IF EXISTS idx_apartment_payments_created_by;

-- Drop the created_by column
ALTER TABLE apartment_payments 
DROP COLUMN IF EXISTS created_by;
