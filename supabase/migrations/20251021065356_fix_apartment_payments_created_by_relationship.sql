/*
  # Fix apartment_payments created_by Foreign Key Relationship

  ## Summary
  This migration fixes the apartment_payments table to properly link the created_by column
  to the auth.users table by first cleaning up orphaned data, then adding the constraint.

  ## Changes Made
  1. Clean up orphaned created_by values (set to NULL if user doesn't exist)
  2. Add foreign key constraint on apartment_payments.created_by referencing auth.users(id)
  3. Set ON DELETE SET NULL behavior so payments remain if a user is deleted
  4. Add index for better query performance on the created_by column

  ## Important Notes
  - This enables proper relationship queries like: apartment_payments -> users:created_by (email)
  - Orphaned records are cleaned up by setting created_by to NULL
  - The constraint uses SET NULL on delete to preserve payment records even if user is removed
*/

-- First, clean up any orphaned created_by values
UPDATE apartment_payments
SET created_by = NULL
WHERE created_by IS NOT NULL 
AND created_by NOT IN (SELECT id FROM auth.users);

-- Add foreign key constraint for created_by column
ALTER TABLE apartment_payments 
DROP CONSTRAINT IF EXISTS apartment_payments_created_by_fkey;

ALTER TABLE apartment_payments 
ADD CONSTRAINT apartment_payments_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_apartment_payments_created_by 
ON apartment_payments(created_by);
