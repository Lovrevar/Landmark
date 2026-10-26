/*
  Voice calls for the in-app voice assistant (docs/voice/02-voice-implementation-plan.md §4.4, §7).

  An in-app call is answered by our voice agent, which asks the voice-llm edge function for each
  reply. voice-llm has no user JWT of its own: the browser's session is handed over server-side by
  voice-session/start, keyed by an opaque call token. This table holds that hand-over.

  - voice_calls: one row per live call. The token itself is never stored, only its SHA-256.
    platform_call_id binds the token to one LiveKit room. access_token is the caller's JWT, a live
    credential for our database, so the table is service-role only: RLS on, no policies, and no
    grants to anon or authenticated.
  - A row is usable only while expires_at > now() (a hard cap of 15 minutes from the start) and
    last_seen_at is within the last 3 minutes; voice-llm checks both in its lookup, so an expired
    row counts as absent even before it is deleted. The 'voice-calls-sweep' job deletes such rows
    every minute; its timing is housekeeping, not a security property.
  - ai_sessions.channel separates voice calls from chat conversations (the chat history list and
    the chat rate limit count only 'chat'); external_call_id is the LiveKit room of a voice call.

  After applying: the sweep needs pg_cron. Without it the migration skips the schedule with a
  notice (LandmarkDev had no pg_cron on 2026-10-26): expired rows are then still refused at lookup,
  but nothing deletes them. Enable pg_cron (Dashboard -> Database -> Extensions) and run the last
  DO block again to schedule it.
*/

CREATE TABLE IF NOT EXISTS public.voice_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL UNIQUE REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  call_token_hash  text NOT NULL UNIQUE,
  platform_call_id text UNIQUE,
  access_token     text NOT NULL,
  expires_at       timestamptz NOT NULL,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_calls FROM anon, authenticated;
GRANT ALL ON public.voice_calls TO service_role;

COMMENT ON TABLE public.voice_calls IS
  'Live in-app voice calls: the caller''s JWT, handed to voice-llm by an opaque call token. Service role only. Rows are deleted on hang-up and swept once expired or idle.';
COMMENT ON COLUMN public.voice_calls.call_token_hash IS
  'SHA-256 (hex) of the opaque call token. The token itself is never stored.';
COMMENT ON COLUMN public.voice_calls.platform_call_id IS
  'The LiveKit room the token is bound to; voice-llm refuses the token for any other room.';
COMMENT ON COLUMN public.voice_calls.access_token IS
  'The caller''s Supabase JWT, rotated by voice-session/refresh. A live credential.';
COMMENT ON COLUMN public.voice_calls.expires_at IS
  'Hard cap: min(JWT expiry, created_at + 15 minutes). A refresh never moves it past the cap.';

ALTER TABLE public.ai_sessions
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS external_call_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_sessions_channel_check'
  ) THEN
    ALTER TABLE public.ai_sessions
      ADD CONSTRAINT ai_sessions_channel_check CHECK (channel IN ('chat', 'voice'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_sessions_external_call_id_idx
  ON public.ai_sessions (external_call_id) WHERE external_call_id IS NOT NULL;

COMMENT ON COLUMN public.ai_sessions.channel IS
  '''chat'' for the chat panel, ''voice'' for an in-app voice call.';
COMMENT ON COLUMN public.ai_sessions.external_call_id IS
  'The LiveKit room of a voice call; null for chat.';

-- Guarded so that `supabase db reset` on a local stack without pg_cron does not fail the whole
-- migration chain.
DO $$
BEGIN
  IF to_regproc('cron.schedule') IS NULL THEN
    RAISE NOTICE 'pg_cron nije dostupan — preskačem čišćenje glasovnih poziva.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('voice-calls-sweep')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'voice-calls-sweep');

  PERFORM cron.schedule(
    'voice-calls-sweep',
    '* * * * *',
    $sweep$DELETE FROM public.voice_calls
           WHERE expires_at < now()
              OR last_seen_at < now() - interval '3 minutes'$sweep$
  );
END $$;
