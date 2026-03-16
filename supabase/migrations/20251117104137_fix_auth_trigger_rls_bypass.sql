/*
  # Fix Auth Trigger to Bypass RLS

  1. Changes
    - Recreate handle_new_user function to properly bypass RLS during user creation
    - Function already has SECURITY DEFINER but needs explicit SET to bypass RLS
    
  2. Security
    - Function is SECURITY DEFINER so it runs with creator's privileges
    - This allows trigger to insert into users table even when RLS would normally block it
*/

-- Drop and recreate the function with proper RLS bypass
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- This bypasses RLS because function is SECURITY DEFINER
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
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
