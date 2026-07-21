/*
  # profiles: admin-only profile updates (mirror of the task app's change)

  The task app made profile management admin-only: profiles_update_own is
  dropped (regular users no longer update their own row — with it goes
  the ability to self-promote via the unrestricted role column) and
  admins may update any profile (the app's user screen calls
  `update({role}).eq('id', ...)`).

  is_admin() is SECURITY DEFINER, so evaluating it inside a profiles
  policy does not recurse through profiles' own RLS. Email/name edits by
  admins are fine; email is re-synced from public.users by trigger.
*/

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
