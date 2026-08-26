/*
  # Microsoft (Entra ID) sign-in: link only, never auto-provision

  handle_new_user() fires on every INSERT into auth.users and, until now,
  created a public.users row with role 'Sales' for ANY new auth identity.
  That is fine for email/password, where accounts are only ever created by an
  admin, but it is a hole once an OAuth provider is enabled: the first person
  to click "Sign in with Microsoft" would be provisioned as a Sales user.

  New rule, split by provider:

  - provider = 'email'  -> unchanged. Admin-created accounts behave exactly as
                           before.
  - any other provider  -> LINK ONLY. The identity is attached to a roster row
                           that an admin has already created in public.users
                           (matched on email, with auth_user_id still NULL).
                           If no such row exists, nothing is inserted, so
                           AuthContext.fetchUserData finds no record and the
                           client refuses the session.

  Note: Supabase already links an OAuth identity to an existing auth.users row
  when the provider returns a verified email that matches a confirmed account,
  and in that case this trigger never fires at all — existing staff who sign in
  with the Microsoft account matching their password account keep the same
  auth_user_id and the same public.users row.

  To onboard someone via Microsoft, an admin inserts the roster row first:

    INSERT INTO public.users (email, username, role)
    VALUES ('ime.prezime@landmark.hr', 'ime.prezime', 'Sales');
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
new_username TEXT;
new_role TEXT;
v_provider TEXT;
v_roster_id UUID;
v_roster_auth_user_id UUID;
BEGIN
v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

-- ---------------------------------------------------------------------
-- Federated sign-in (azure/...): attach to a pre-provisioned roster row.
-- ---------------------------------------------------------------------
IF v_provider <> 'email' THEN
  SELECT id, auth_user_id
    INTO v_roster_id, v_roster_auth_user_id
    FROM public.users
   WHERE NEW.email IS NOT NULL
     AND lower(email) = lower(NEW.email);

  IF v_roster_id IS NULL THEN
    -- Unknown identity. No app account is created; the client sees
    -- no_user_record and signs the session straight back out.
    RAISE WARNING 'handle_new_user: refused % sign-in for unprovisioned email %',
      v_provider, NEW.email;
    RETURN NEW;
  END IF;

  IF v_roster_auth_user_id IS NOT NULL AND v_roster_auth_user_id <> NEW.id THEN
    -- The roster row already belongs to a different auth identity. Do not
    -- reassign it — that would hand this person someone else's account.
    RAISE WARNING 'handle_new_user: % sign-in for % already bound to auth user %',
      v_provider, NEW.email, v_roster_auth_user_id;
    RETURN NEW;
  END IF;

  -- Fires sync_profile_from_user, which mirrors the row into profiles.
  UPDATE public.users
     SET auth_user_id = NEW.id
   WHERE id = v_roster_id
     AND auth_user_id IS NULL;

  RETURN NEW;
END IF;

-- ---------------------------------------------------------------------
-- Email/password signup: unchanged behaviour.
-- ---------------------------------------------------------------------
new_username := COALESCE(
NEW.raw_user_meta_data->>'username',
SPLIT_PART(NEW.email, '@', 1)
);

new_role := COALESCE(NEW.raw_app_meta_data->>'role', 'Sales')::TEXT;

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
