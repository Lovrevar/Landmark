/*
  # Simplify handle_new_user trigger to avoid RLS issues

  1. Changes
    - Remove WHILE loop that queries users table during INSERT
    - This loop can cause "Database error querying schema" during login
    - Simply use ON CONFLICT to handle duplicates instead
    
  2. Security
    - Function remains SECURITY DEFINER to bypass RLS
    - No queries during INSERT that could trigger RLS recursion
*/

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

  
  -- Insert into public.users with generated username
  -- If auth_user_id already exists, update the record
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
    username = EXCLUDED.username,
    role = EXCLUDED.role;

  
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail authentication
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;

    RETURN NEW;

END;

$$;


-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

;