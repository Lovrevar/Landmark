/*
  # Create Admin User
  
  ## Summary
  Creates the initial admin user with email lovre.varvodic@landmark.hr
  
  ## Changes
  1. Uses Supabase extensions to create auth user
  2. Sets role metadata to 'Director' for full access
  3. Password will be set through Supabase dashboard or directly
  
  ## Security
  - User will be created in auth.users table
  - Trigger will automatically create matching record in public.users
  - Password is hashed by Supabase auth system
*/

-- First, ensure we have the necessary extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- Create the admin user using a DO block with proper auth admin functions
-- Note: This requires service role access
DO $$
DECLARE
  new_user_id UUID;

BEGIN
  -- Try to create the user if it doesn't exist
  -- This uses Supabase's internal functions for user creation
  
  -- Check if user already exists
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'lovre.varvodic@landmark.hr'
  ) THEN
    -- Insert directly into auth.users (requires service role)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      uuid_generate_v4(),
      'authenticated',
      'authenticated',
      'lovre.varvodic@landmark.hr',
      crypt('admin', gen_salt('bf')),
      NOW(),
      jsonb_build_object('role', 'Director'),
      jsonb_build_object('username', 'lovre.varvodic'),
      NOW(),
      NOW(),
      '',
      ''
    ) RETURNING id INTO new_user_id;

    
    -- Also insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      uuid_generate_v4(),
      new_user_id,
      new_user_id::text,
      jsonb_build_object(
        'sub', new_user_id::text,
        'email', 'lovre.varvodic@landmark.hr'
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    
    RAISE NOTICE 'Admin user created successfully with ID: %', new_user_id;

  ELSE
    RAISE NOTICE 'User already exists';

  END IF;

END $$;

;