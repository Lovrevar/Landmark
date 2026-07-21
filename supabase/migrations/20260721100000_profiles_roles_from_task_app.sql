/*
  # profiles: explicit admin roster instead of Director -> admin mapping

  The task-app admin set is now managed explicitly in profiles, seeded 1:1
  (by email) from the colleague's original task-app database. The ids and
  created_at from that database are NOT copied — profiles.id must match
  THIS project's auth.users ids, which differ per person.

  Changes:
  1. sync_profile_from_user() and handle_new_user() stop deriving
     profiles.name/role from public.users on every change — after the
     initial insert (role defaults to 'user'), only email keeps syncing.
     profiles.name/role are owned by the profiles table from now on.
  2. Backfill name + role for the known roster, matched by email.
     Emails that have no profile in this project (e.g. admin@firma.hr,
     which only existed in the old task-app project) are ignored.
*/

-- 1a) users -> profiles sync: insert-only for name/role, email keeps syncing.
CREATE OR REPLACE FUNCTION public.sync_profile_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = NEW.auth_user_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, created_at)
  VALUES (
    NEW.auth_user_id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.username, split_part(NEW.email, '@', 1), 'user'),
    'user',
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

-- 1b) Same rule in the signup trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
new_username TEXT;
new_role TEXT;
BEGIN
-- Generate username from email or metadata
new_username := COALESCE(
NEW.raw_user_meta_data->>'username',
SPLIT_PART(NEW.email, '@', 1)
);

new_role := COALESCE(NEW.raw_app_meta_data->>'role', 'Sales')::TEXT;

-- Insert into public.users with generated username
-- If auth_user_id already exists, update the record
INSERT INTO public.users (auth_user_id, username, email, role, created_at)
VALUES (
NEW.id,
new_username,
NEW.email,
new_role,
NOW()
)
ON CONFLICT (auth_user_id) DO UPDATE
SET
email = EXCLUDED.email,
username = EXCLUDED.username,
role = EXCLUDED.role;

-- Mirror into profiles (mobile task app reads this table). Name/role are
-- set only on first insert; task-app admins are managed in profiles.
INSERT INTO public.profiles (id, email, name, role)
VALUES (
NEW.id,
COALESCE(NEW.email, ''),
new_username,
'user'
)
ON CONFLICT (id) DO UPDATE
SET
email = EXCLUDED.email;

RETURN NEW;
EXCEPTION
WHEN OTHERS THEN
-- Log error but don't fail authentication
RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
RETURN NEW;
END;
$$;

-- 2) Seed the roster (matched by email; unmatched emails are skipped).
UPDATE public.profiles p
SET name = v.name, role = v.role
FROM (VALUES
  ('marija.culjak@landmark.hr',      'Marija Culjak',      'user'),
  ('z.petkovic@landmark.hr',         'Zeljko Petkovic',    'admin'),
  ('david.koljnrekaj@landmark.hr',   'David Koljnrekaj',   'admin'),
  ('domagoj.prsa@landmark.hr',       'Domagoj Prsa',       'user'),
  ('anamarija.drinovac@landmark.hr', 'Anamarija Drinovac', 'user'),
  ('admin@firma.hr',                 'Admin',              'admin'),
  ('kresimir.juras@landmark.hr',     'Kresimir Juras',     'user'),
  ('lovre.varvodic@landmark.hr',     'Lovre Varvodic',     'admin'),
  ('hana@landmark.hr',               'Hana Ibrahimpasic',  'user'),
  ('petra.krmek@landmark.hr',        'Petra Krmek',        'user'),
  ('marija.belinic@landmark.hr',     'Marija Belinic',     'user'),
  ('dilho@landmark.hr',              'Dilho Ibrahimpasic', 'user')
) AS v(email, name, role)
WHERE lower(p.email) = lower(v.email);
