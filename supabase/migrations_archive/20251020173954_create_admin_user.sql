/*
  # Create Initial Admin User

  1. User Creation
    - Creates admin user in auth.users table
    - Email: lovre.varvodic@landmark.hr
    - Password: admin
    - Role: Director (full access to all features)
  
  2. Security
    - Uses Supabase's secure password hashing
    - Trigger automatically creates matching public.users record
    - Sets Director role for full system access
*/

-- Create admin user in auth.users with proper metadata
-- The trigger will automatically create the corresponding public.users record
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
  recovery_token,
  email_change_token_new,
  email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'lovre.varvodic@landmark.hr',
  crypt('admin', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"],"role":"Director"}',
  '{"username":"lovre"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'lovre.varvodic@landmark.hr'
);
