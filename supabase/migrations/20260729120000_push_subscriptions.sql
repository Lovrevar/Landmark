/*
  # Web Push subscriptions for the standalone mobile task app

  The colleague's mobile task app (schema in todoMigrations/) points at THIS
  database, so its Web Push feature needs its table and write function here —
  not in that app's own Supabase project. This is the Landmark-owned
  counterpart of todoMigrations/20260729120000_push_subscriptions.sql; the two
  bodies are identical, only this header differs.

  The standing rule still holds: nothing in todoMigrations/ is run against this
  DB. Unlike create_core_schema.sql, whose handle_new_user() would clobber
  ours, this one happens to be harmless if double-applied — every statement is
  idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE) — but
  this file, not that one, is the version of record.

  1. `public.push_subscriptions` — one row per browser/device that opted in.
     - `endpoint` text PK — the push service URL, already unique per browser
       install, so it doubles as the natural key.
     - `user_id` uuid -> profiles(id) ON DELETE CASCADE. profiles.id is
       auth.uid() here (see 20260720120000_tasks_mobile_compat.sql), so this is
       the same id space the mobile app uses.
     - `p256dh` / `auth` — the client's encryption keys, straight from
       PushSubscription.toJSON().keys, needed to encrypt the payload (RFC 8291).
     - `user_agent` — support only ("which phone is this?"), truncated to 300.
     - `created_at` — the app re-registers on every login and the write function
       replaces the row rather than updating it, so this doubles as "last seen".

  2. `public.save_push_subscription()` SECURITY DEFINER — the only supported
     write path. See the comment above the function for why a plain upsert
     cannot work on a shared site phone.

  ## RLS
  SELECT and DELETE are owner-scoped: a subscription is a capability to write to
  someone's lock screen, so nobody sees anyone else's devices. There is
  deliberately NO INSERT or UPDATE policy — writes go through
  save_push_subscription(). The send-push edge function reads every row via the
  service role, which bypasses RLS.

  ## Notes
  - No notification-preferences table. The row IS the preference: the bell being
    on means a row exists, off means it was deleted.
  - Nothing here cleans up dead endpoints. That happens in the send-push edge
    function, which deletes a row when the push service answers 404 or 410.
*/

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint     text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The function fans out by recipient, so the user lookup is the hot path.
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

-- ---------- RLS: owner-scoped on every verb ----------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- No INSERT or UPDATE policy on purpose — see save_push_subscription() below.

-- ---------- write path ----------
-- An endpoint identifies a *browser*, not a person. On a shared site phone, user B
-- logging in after user A hands us the endpoint that is already stored against A.
-- A self-scoped `ON CONFLICT (endpoint) DO UPDATE` cannot resolve that: the
-- conflicting row belongs to A and is invisible to B under RLS, so the upsert dies
-- on a unique violation the client cannot recover from — and until it does, A's task
-- notifications keep landing on the phone B is now holding.
--
-- So: delete by endpoint with the function's privileges, then insert as the caller.
CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Niste prijavljeni.';
  END IF;
  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'Neispravna pretplata na obavijesti.';
  END IF;

  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;

  INSERT INTO public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  VALUES (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;
