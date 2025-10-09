/*
  # Fix Wire Payments Created By Reference

  1. Changes
    - Drop the existing foreign key constraint on created_by that references auth.users
    - Add a new foreign key constraint that references the custom users table
    - This fixes the payment recording error where created_by doesn't match auth.users

  2. Notes
    - The application uses a custom users table, not Supabase auth.users
    - The created_by field should reference the custom users table
    - Existing payments with invalid created_by values will remain but won't cause issues
*/

-- Drop the old foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wire_payments_created_by_fkey' 
    AND table_name = 'wire_payments'
  ) THEN
    ALTER TABLE wire_payments DROP CONSTRAINT wire_payments_created_by_fkey;
  END IF;
END $$;

-- Add new foreign key constraint referencing the custom users table
-- Make created_by nullable to avoid issues with existing records
ALTER TABLE wire_payments 
  ALTER COLUMN created_by DROP NOT NULL;

-- Add the correct foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wire_payments_created_by_users_fkey' 
    AND table_name = 'wire_payments'
  ) THEN
    ALTER TABLE wire_payments 
      ADD CONSTRAINT wire_payments_created_by_users_fkey 
      FOREIGN KEY (created_by) 
      REFERENCES users(id) 
      ON DELETE SET NULL;
  END IF;
END $$;