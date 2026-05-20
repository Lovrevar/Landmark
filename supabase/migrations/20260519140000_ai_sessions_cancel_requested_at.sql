/*
  # AI Chat — DB-backed cancel beacon

  Adds a per-session timestamp the client sets when the user clicks the
  in-chat stop button. The edge function's orchestration loop polls this
  column at iteration boundaries and after each tool dispatch; if it is
  non-null AND newer than the loop's own request-start timestamp, the loop
  aborts without further DB writes or model calls.

  Why a DB-backed signal rather than transport-layer cancellation:
  Supabase's Edge Function runtime (supabase-edge-runtime-1.74.0, Deno
  v2.1.4 as of 2026-05) does not propagate client TCP disconnect into user
  code via `req.signal`, `writer.closed`, or write failures on the response
  stream. Deno's internal HTTP layer detects the dead socket (it surfaces as
  a BadResource error in function logs) but never feeds that back to the
  handler. Until that gap is closed upstream, a DB beacon is the only
  mechanism we've found that reliably crosses the runtime boundary.

  RLS: the column is owner-scoped UPDATE-able via the existing policies on
  ai_sessions; no new policies are required.
*/

ALTER TABLE public.ai_sessions
  ADD COLUMN cancel_requested_at timestamptz;

COMMENT ON COLUMN public.ai_sessions.cancel_requested_at IS
  'Cancel beacon. The chat stop button writes now() here; the orchestration '
  'loop reads it at iteration boundaries and treats any value newer than its '
  'own request start as a cancel signal.';
