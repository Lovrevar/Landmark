/*
# Task-app-only people, through the Auth admin API (COLLAB-18)

20261110100100_task_app_only_users.sql taught handle_new_user() to skip the public.users roster
row when the new auth user carries app_metadata.task_app_only = true. It never sees that flag
from the one caller that sets it. Supabase Auth's admin create endpoint (supabase/auth,
adminUserCreate) runs, inside one transaction:

    INSERT auth.users            -- raw_app_meta_data = {"provider","providers"} only
    INSERT auth.identities
    UPDATE auth.users SET role
    UPDATE auth.users SET raw_app_meta_data   <- the request's app_metadata is merged HERE
    UPDATE auth.users SET email_confirmed_at

on_auth_user_created is AFTER INSERT, so it fires at the first line, reads no flag, and
provisions a Sales user; the flag arrives one statement later with nothing listening. Confirmed
on production on 2026-11-10 with the first person created that way.

## The fix
A second trigger, AFTER UPDATE OF raw_app_meta_data, that fires only when task_app_only turns
true and undoes what the insert trigger just provisioned:

- the public.users row is deleted — but only if it was created within the last minute, i.e.
  by this sign-up. A long-standing roster row is a real Landmark user, and setting the flag
  on them (which only the service role can do) leaves them alone with a WARNING;
- the profiles row (which sync_profile_from_user created from the roster insert, named after
  the username) is marked external, forced to role 'user', and named from user_metadata.name.

The end state is the one the direct-insert branch of handle_new_user() produces, so that branch
stays: it is what a direct INSERT (the pgTAP fixtures) and any future GoTrue that writes
app_metadata at insert time still take.

## Why not carry the flag in user_metadata instead
It is present at insert time, which would make this trigger unnecessary — but user_metadata is
writable by anyone who can sign up (signUp options.data, OTP sign-ups), so the "service role
only" property the task app chose app_metadata for would then rest on sign-ups being disabled
in the Auth settings. app_metadata stays the carrier.

## No EXCEPTION block, on purpose
handle_new_user() swallows every error into a WARNING so that a failure never blocks
authentication. Here the opposite is wanted: if the undo cannot be done, the whole admin create
must fail (GoTrue's transaction rolls back and no user is left behind) rather than silently
leave a Landmark user. The API then answers 500 "Database error updating user", which the
manage-users edge function reports as "not created".

## What this relies on
An `UPDATE OF <column>` trigger fires only when the column is named in the SET list. GoTrue's
UpdateAppMetaData does `UpdateOnly(u, "raw_app_meta_data", "updated_at")`, so it is. If a future
GoTrue wrote the whole row with a full UPDATE this still fires; it would stop firing only if
app_metadata were set some other way than an UPDATE of that column.

Idempotent: CREATE OR REPLACE, DROP TRIGGER IF EXISTS. 20261110100100 is unchanged and stays as
applied. Test: supabase/tests/database/task_app_only_admin_api.test.sql.

## After applying
Dev first, then production, by hand (docs/SHARED_SCHEMA.md §12). Then deploy the manage-users
edge function from this repo to the same project: it reads profiles.external back after every
create and deletes the auth user again if the trigger did not mark it.
*/

CREATE OR REPLACE FUNCTION public.handle_auth_user_task_app_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  -- Undo only what this sign-up provisioned moments ago. now() is the transaction start, and
  -- handle_new_user() stamped created_at = NOW() in this same transaction; the minute of slack
  -- covers a GoTrue that ever split its steps across transactions. A roster row older than
  -- that is a real Landmark user and is never deleted, whatever the flag says.
  DELETE FROM public.users
   WHERE auth_user_id = NEW.id
     AND created_at >= now() - interval '1 minute';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 AND EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = NEW.id) THEN
    RAISE WARNING 'handle_auth_user_task_app_only: % already has a roster row; left as a Landmark user',
      NEW.email;
    RETURN NEW;
  END IF;

  -- The profile normally exists already (sync_profile_from_user made it from the roster row,
  -- named after the username). The INSERT arm covers a handle_new_user() that swallowed an
  -- error before writing it.
  INSERT INTO public.profiles (id, email, name, role, external)
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    coalesce(nullif(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    'user',
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET external = true,
        role     = 'user',
        name     = coalesce(nullif(NEW.raw_user_meta_data->>'name', ''), public.profiles.name);

  RETURN NEW;
END;
$$;

-- Same lock-down as sync_task_completion_from_subtasks: a DEFINER trigger function is not for
-- calling. EXECUTE is checked when the trigger is created, by the migration role, not when
-- supabase_auth_admin's UPDATE fires it.
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_task_app_only() FROM public;

DROP TRIGGER IF EXISTS on_auth_user_task_app_only ON auth.users;

-- The WHEN clause keeps this off GoTrue's other raw_app_meta_data rewrites (the providers
-- array on identity linking, for one). ->> renders a jsonb true and a "true" string alike.
CREATE TRIGGER on_auth_user_task_app_only
  AFTER UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_app_meta_data->>'task_app_only' = 'true'
        AND OLD.raw_app_meta_data->>'task_app_only' IS DISTINCT FROM 'true')
  EXECUTE FUNCTION public.handle_auth_user_task_app_only();
