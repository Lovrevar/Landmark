/*
# Web Push subscriptions

## Purpose
Stores one Web Push endpoint per browser/device a user has opted in from, so the
`send-push` edge function can reach them when a task is assigned or completed.

## New table
- `push_subscriptions`
  - `endpoint` text PK — the push service URL. Already unique per browser install,
    so it doubles as the natural key. No surrogate id needed.
  - `user_id` uuid FK -> profiles(id) ON DELETE CASCADE. Deleting a user takes their
    devices with them.
  - `p256dh` / `auth` text — the client's encryption keys, straight from
    `PushSubscription.toJSON().keys`. Required to encrypt the payload (RFC 8291).
  - `user_agent` text NULL — support only ("which phone is this?").
  - `created_at` timestamptz — when this device last registered. The app re-registers
    on every login, and save_push_subscription() replaces the row rather than updating
    it, so this doubles as "last seen".

## New function
- `save_push_subscription()` SECURITY DEFINER — the only supported way to write a
  row. See the comment on the function for why a plain upsert cannot work.

## Security — RLS
This is the FIRST table in the schema that is not world-readable. Every other table
uses `USING (true)` because tasks and profiles are shared team artifacts. A push
subscription is different: it is a capability to send arbitrary content to someone's
lock screen, so each user sees and manages only their own rows.

SELECT and DELETE are owner-scoped. There is deliberately no INSERT or UPDATE policy:
writes go through `save_push_subscription()`. The `send-push` edge function reads
every row via the service role, which bypasses RLS — the same pattern `manage-users`
already uses for auth admin work.

## Notes
1. No notification-preferences table. The subscription row IS the preference: the
   bell being on means a row exists, off means it was deleted. With only two event
   types, a per-event preference table would be speculative.
2. Nothing here cleans up dead endpoints. That happens in `send-push`, which deletes
   a row when the push service answers 404 or 410 (subscription gone).
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
