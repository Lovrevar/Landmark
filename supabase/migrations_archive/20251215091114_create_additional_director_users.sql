/*
  # Create Additional Director Users

  1. User Creation
    - Creates two new director users in auth.users table
    - marko.brkic@landmark.hr (password: landmark888)
    - iva.paljan@landmark.hr (password: IvanaiNiko)
    - Role: Director (full access to all features)
  
  2. Security
    - Uses Supabase's secure password hashing (bcrypt)
    - Trigger automatically creates matching public.users records
    - Sets Director role for full system access
*/

-- Create Marko Brkic director user
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
  'marko.brkic@landmark.hr',
  crypt('landmark888', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"],"role":"Director"}',
  '{"username":"marko.brkic"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'marko.brkic@landmark.hr'
);

-- Create Iva Paljan director user
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
  'iva.paljan@landmark.hr',
  crypt('IvanaiNiko', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"],"role":"Director"}',
  '{"username":"iva.paljan"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'iva.paljan@landmark.hr'
);
