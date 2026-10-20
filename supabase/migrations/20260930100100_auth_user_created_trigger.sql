/*
  # Recreate the auth.users provisioning trigger in a migration

  DEFECT_BACKLOG AUTH-2. `on_auth_user_created` (AFTER INSERT ON auth.users → handle_new_user())
  exists on the long-lived projects but was never captured by a migration: the 2026-05-15
  baseline dumped only the `public` schema. A project built from migrations alone (demo, a fresh
  e2e project) therefore created no public.users row for new sign-ups, and AuthContext signed
  them straight back out.

  Idempotent. On projects that already have the trigger this drops and recreates it unchanged.
  The function body is the one from 20260825100000_sso_pre_provisioned_only.sql.
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
