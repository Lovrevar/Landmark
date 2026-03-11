/*
  # Create PM Test User and Assign to Kožara Project

  ## Summary
  Creates a test Project Manager user (pmosijek@landmark.hr) with Supervision role
  and assigns them to the Kožara project for testing the PM permission system.

  ## Changes
  1. Creates auth user pmosijek@landmark.hr with password 123456
  2. Creates corresponding public.users record with Supervision role
  3. Assigns the PM to Kožara project via project_managers table

  ## Security
  - User has Supervision role
  - Only has access to assigned projects (Kožara)
  - Cannot view or manage payments
*/

DO $$
DECLARE
  new_auth_id UUID;
  new_user_id UUID;
  kozara_project_id UUID;
BEGIN
  -- Get Kožara project ID
  SELECT id INTO kozara_project_id FROM projects WHERE name LIKE '%Kožara%' LIMIT 1;
  
  IF kozara_project_id IS NULL THEN
    RAISE EXCEPTION 'Kožara project not found';
  END IF;

  -- Create auth user
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
  ) VALUES (
    gen_random_uuid(),
    'pmosijek@landmark.hr',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"],"role":"Supervision"}'::jsonb,
    '{"username":"pmosijek"}'::jsonb,
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO new_auth_id;
  
  -- Create public.users record (trigger should handle this, but we'll do it explicitly)
  INSERT INTO users (auth_user_id, username, email, role, created_at)
  VALUES (
    new_auth_id,
    'pmosijek',
    'pmosijek@landmark.hr',
    'Supervision',
    NOW()
  )
  ON CONFLICT (auth_user_id) DO UPDATE 
  SET role = 'Supervision', email = 'pmosijek@landmark.hr'
  RETURNING id INTO new_user_id;
  
  -- Assign PM to Kožara project
  INSERT INTO project_managers (user_id, project_id, notes, assigned_at)
  VALUES (
    new_user_id,
    kozara_project_id,
    'Test PM user for Kožara project - Created for testing project manager permissions',
    NOW()
  )
  ON CONFLICT (user_id, project_id) DO NOTHING;
  
  RAISE NOTICE 'Successfully created PM user pmosijek@landmark.hr and assigned to Kožara project';
  
EXCEPTION
  WHEN unique_violation THEN
    -- User might already exist, just assign to project
    SELECT id INTO new_user_id FROM users WHERE email = 'pmosijek@landmark.hr';
    
    IF new_user_id IS NOT NULL THEN
      -- Update role to Supervision
      UPDATE users SET role = 'Supervision' WHERE id = new_user_id;
      
      -- Assign to project
      INSERT INTO project_managers (user_id, project_id, notes, assigned_at)
      VALUES (
        new_user_id,
        kozara_project_id,
        'Test PM user for Kožara project - Updated assignment',
        NOW()
      )
      ON CONFLICT (user_id, project_id) DO NOTHING;
      
      RAISE NOTICE 'Updated existing user pmosijek@landmark.hr and assigned to Kožara project';
    END IF;
END $$;
