/*
  # Synchronize public.users IDs with auth.users

  1. Problem
    - public.users table has old UUID values that don't match auth.users IDs
    - This breaks RLS policies that check user roles via auth.uid()
    - Users can't access data because role lookups fail

  2. Solution
    - Update all public.users IDs to match their corresponding auth.users IDs
    - Match based on email addresses
    - CASCADE updates will handle all foreign key relationships
    
  3. Changes
    - Update IDs for all existing users
    - Related tables will update automatically via ON UPDATE CASCADE
*/

-- Update each user's ID to match auth.users (already did anamarija and admin)
UPDATE public.users 
SET id = '875cc8a5-03d5-432a-9ad7-193c65c76331'
WHERE email = 'dilho@landmark.hr' AND id != '875cc8a5-03d5-432a-9ad7-193c65c76331';

UPDATE public.users 
SET id = 'a35f0d38-d341-4b7c-b9f3-fcfae86dc8f8'
WHERE email = 'hana@landmark.hr' AND id != 'a35f0d38-d341-4b7c-b9f3-fcfae86dc8f8';

UPDATE public.users 
SET id = '98d6b8c0-5e71-4f5d-8aa0-bf7ce81b4ef2'
WHERE email = 'kresimir.juras@landmark.hr' AND id != '98d6b8c0-5e71-4f5d-8aa0-bf7ce81b4ef2';

UPDATE public.users 
SET id = '931da977-a7fa-4bba-93f1-163d4c052c95'
WHERE email = 'lovre.varvodic@landmark.hr' AND id != '931da977-a7fa-4bba-93f1-163d4c052c95';

UPDATE public.users 
SET id = 'a349c1cd-1a6a-4187-9330-d9f9ba880097'
WHERE email = 'petra.krmek@landmark.hr' AND id != 'a349c1cd-1a6a-4187-9330-d9f9ba880097';

UPDATE public.users 
SET id = '2c0a543b-4db8-4a7f-a027-1084ebffb5a9'
WHERE email = 'pmosijek@landmark.hr' AND id != '2c0a543b-4db8-4a7f-a027-1084ebffb5a9';

UPDATE public.users 
SET id = '04635699-1c7d-47ec-8c9e-069fac45c82c'
WHERE email = 'z.petkovic@landmark.hr' AND id != '04635699-1c7d-47ec-8c9e-069fac45c82c';

-- Verify the synchronization
SELECT 
  COUNT(*) as synced_users
FROM auth.users au
INNER JOIN public.users u ON au.id = u.id;
