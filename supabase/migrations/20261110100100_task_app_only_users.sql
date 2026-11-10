/*
# Task-app-only people

The task app sometimes needs an account for someone outside the company. Such a person is a
profiles row and nothing else: handle_new_user() skips the public.users insert when the
auth user carries app_metadata.task_app_only = true, which only the service role can set
(the task app's manage-users edge function does). With no roster row, Landmark's client
refuses the session (no_user_record) and no Landmark picker lists them. The task and room
policies consult auth.uid() and profiles only, so the task app works for them in full.

profiles.external marks such a row so the task app can label it and keep the admin toggle
off it. No backfill: every existing profile has a roster row.

## Three things to know before touching this
- `external` is a label, not a boundary. profiles_update_admin is a row-level policy and the
  table has no column grants, so a task-app admin can flip it on anyone (as they can already
  set role = 'admin'). What keeps such a person out of Landmark is the MISSING public.users
  row: AuthContext raises no_user_record and signs the session out, and fetchTaskUsers() reads
  public.users, so no picker lists them.
- Staff names do not move. For an ordinary sign-up the INSERT INTO public.users below fires
  sync_profile_from_user synchronously, and THAT creates the profiles row (name = username);
  the profiles upsert at the end of this function then only syncs email through ON CONFLICT.
  The new COALESCE(raw_user_meta_data->>'name', new_username) therefore reaches the INSERT path
  only for a task-app-only person, who has no roster row and so never ran the sync trigger.
- Re-hire. If an external person is later added to the roster (a public.users row with their
  auth_user_id), sync_profile_from_user updates email only, so external stays true. Flip it to
  false by hand.

## Known gap — COLLAB-18
This works for a row INSERTed with the flag (the pgTAP test), but NOT for a user created
through the Auth admin API: GoTrue inserts the row with app_metadata = {provider, providers}
and merges the request's app_metadata in a later UPDATE, so the AFTER INSERT trigger never
sees task_app_only and provisions a Sales user. Confirmed on production on 2026-11-10. Fixed
by 20261110100200_task_app_only_admin_api.sql, a second trigger on UPDATE OF raw_app_meta_data
that undoes the roster row; this file is left as applied, and its branch still serves a row
inserted with the flag.

Idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE on the trigger function. The
trigger itself (on_auth_user_created, 20260930100100) is unchanged. Everything outside the
new IF in the email branch is the body from 20260825100000_sso_pre_provisioned_only.sql.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS external boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.external IS
  'True for a task-app-only person: an auth user with no public.users row, created by the task app''s manage-users function with app_metadata.task_app_only = true. Never a Landmark user.';

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
v_task_app_only BOOLEAN;
BEGIN
v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

-- ---------------------------------------------------------------------
-- Federated sign-in (azure/...): attach to a pre-provisioned roster row.
-- (unchanged)
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
-- Email/password signup.
-- ---------------------------------------------------------------------
new_username := COALESCE(
NEW.raw_user_meta_data->>'username',
SPLIT_PART(NEW.email, '@', 1)
);

-- app_metadata is written by the admin API only, never by the user, so this flag can only
-- come from a service-role caller: the task app's manage-users function.
v_task_app_only := COALESCE(NEW.raw_app_meta_data->>'task_app_only', 'false') = 'true';

IF NOT v_task_app_only THEN
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
END IF;

-- Mirror into profiles (the task app reads this table). Name/role are set only on first
-- insert; task-app admins are managed in profiles. A task-app-only person gets no roster
-- row above, so this is their only row; the name comes from what manage-users sent.
INSERT INTO public.profiles (id, email, name, role, external)
VALUES (
NEW.id,
COALESCE(NEW.email, ''),
COALESCE(NEW.raw_user_meta_data->>'name', new_username),
'user',
v_task_app_only
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
