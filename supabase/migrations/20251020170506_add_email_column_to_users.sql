/*
  # Add Email Column to Public Users Table

  ## Changes
  
  1. Add email column to public.users table
  2. Create unique index on email column
  
  ## Security
  - Maintains all existing RLS policies
*/

-- Add email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.users ADD COLUMN email TEXT;
  END IF;
END $$;

-- Create unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users(email) WHERE email IS NOT NULL;
