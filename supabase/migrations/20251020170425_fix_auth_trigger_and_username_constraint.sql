/*
  # Fix Authentication Trigger and Username Constraint

  ## Changes
  
  1. Make username column nullable to allow trigger to work
  2. Update trigger function to properly handle username generation
  3. Add default value for role column
  
  ## Security
  - Maintains all existing RLS policies
  - No changes to authentication flow
*/

-- Make username nullable temporarily to avoid insert failures
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Update the trigger function to handle username properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_username TEXT;
BEGIN
  -- Generate username from email or metadata
  new_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    SPLIT_PART(NEW.email, '@', 1)
  );
  
  -- Ensure username is unique by appending a number if needed
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = new_username) LOOP
    new_username := new_username || '_' || floor(random() * 1000)::text;
  END LOOP;

  -- Insert into public.users with generated username
  INSERT INTO public.users (auth_user_id, username, email, role, created_at)
  VALUES (
    NEW.id,
    new_username,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'role', 'Sales')::TEXT,
    NOW()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    username = EXCLUDED.username;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
