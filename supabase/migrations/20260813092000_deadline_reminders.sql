/*
# Deadline reminders

Mirrors 20260812092000_deadline_reminders.sql in the standalone mobile task app, which shares
these tables. Cognilion hosts the send-push edge function, so it hosts the scheduler too.

## What fires, and to whom
  - day_before : the deadline is tomorrow  -> assignees
  - due_today  : the deadline is today     -> assignees
  - overdue    : the deadline has passed   -> assignees + whoever created the task

Completed tasks never generate anything. Overdue stops after 30 days: a task that has nagged
every morning for three months has taught everyone to swipe the notification away without
reading it, which costs you the ones that matter.

Two Cognilion-specific consequences of "recipients are the assignees", neither of which needs
special-casing here:
  - A private task makes its creator the sole assignee (see createTask in tasksService.ts), so
    a private task reminds only its owner. Correct by construction.
  - Cognilion's quick-add creates tasks with no assignees at all. Those claim a row and notify
    nobody until they go overdue, at which point the creator hears about it. That is the right
    outcome for an unassigned task, and a claim with no recipients costs one row.

## Why a table rather than flags on `tasks`
task_reminders is keyed (task_id, kind, sent_on), and that key does the work:
  - "once per day" for the daily overdue nag IS the primary key, not application logic;
  - moving a deadline needs no cleanup — the new date is simply a different sent_on, so the
    reminder fires again for the new date and only for it;
  - claiming is one race-free statement (INSERT ... ON CONFLICT DO NOTHING RETURNING) rather
    than a read-then-write;
  - `tasks` stays free of scheduler bookkeeping, and it is the app's hottest table.

## Why pg_cron + pg_net rather than an external scheduler
net.http_post() does not send anything. It queues a row that a background worker picks up
AFTER COMMIT, so the claim and the send share one transaction: if this function raises, the
claim rolls back and the request never leaves. An external cron would commit the claim over
one connection and then make the HTTP call over another, and a crash in between marks a
reminder as sent that nobody ever received.

The trade, stated plainly: a reminder can be lost, never duplicated. pg_net records a failed
response in net._http_response and nothing retries it. For reminders that is the right way
round, and the overdue kind heals itself the next morning.

## Timing
cron.schedule runs in UTC; Croatia is UTC+1 or UTC+2 depending on the season. So the job runs
hourly and the function gates on the LOCAL hour — one job, no DST maintenance. The window is
07-09 rather than exactly 07 because the claim table makes repeat runs free, which turns 08:00
and 09:00 into a catch-up if 07:00 was missed or the database happened to be restarting.

## One-time manual setup (NOT in this migration — secrets do not belong in git)
  1. Dashboard -> Database -> Extensions: enable `pg_cron` and `pg_net`.
  2. Deploy send-push FIRST. A dispatcher that fires at a version of the function which
     rejects reminder_* has already committed its claims, and that morning is gone.
       supabase functions deploy send-push
       supabase secrets set REMINDER_SECRET=<32 random bytes, base64>
  3. In the SQL editor:
       select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'send_push_url');
       select vault.create_secret('<service_role key>', 'send_push_service_key');
       select vault.create_secret('<the same REMINDER_SECRET>', 'reminder_secret');
  See docs/TASKS.md for the full walkthrough and the test recipe.
*/

CREATE TABLE IF NOT EXISTS public.task_reminders (
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('day_before','due_today','overdue')),
  sent_on    date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, kind, sent_on)
);

-- Scheduler bookkeeping, not app data. Nothing in either client reads it: the dispatcher below
-- is SECURITY DEFINER and send-push uses the service role, and both bypass RLS. RLS is enabled
-- anyway so that a missing grant is not the only thing standing between this table and a
-- curious anon key.
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_reminders FROM anon, authenticated;

-- Claim the morning's reminders and queue one push per claim.
--
-- p_force skips the hour gate. That is how this gets tested without waiting until tomorrow
-- morning:  select public.dispatch_due_reminders(true);
CREATE OR REPLACE FUNCTION public.dispatch_due_reminders(p_force boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_today  date := (now() AT TIME ZONE 'Europe/Zagreb')::date;
  v_hour   int  := extract(hour FROM (now() AT TIME ZONE 'Europe/Zagreb'))::int;
  v_url    text;
  v_key    text;
  v_secret text;
  v_count  int := 0;
  r        record;
BEGIN
  IF NOT p_force AND (v_hour < 7 OR v_hour > 9) THEN
    RETURN 0;
  END IF;

  -- Read the configuration BEFORE claiming anything. Raising here leaves no trace, which is
  -- exactly right: a misconfiguration must not silently burn a day's reminders by marking them
  -- sent and then failing to send them.
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'send_push_url';
  SELECT decrypted_secret INTO v_key    FROM vault.decrypted_secrets WHERE name = 'send_push_service_key';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'reminder_secret';

  IF v_url IS NULL OR v_key IS NULL OR v_secret IS NULL THEN
    RAISE EXCEPTION 'Podsjetnici nisu konfigurirani (nedostaje tajna u vaultu).';
  END IF;

  FOR r IN
    WITH due AS (
      SELECT t.id AS task_id,
             CASE
               WHEN t.deadline < v_today THEN 'overdue'
               WHEN t.deadline = v_today THEN 'due_today'
               ELSE 'day_before'
             END AS kind
      FROM public.tasks t
      WHERE t.completed = false
        AND t.deadline IS NOT NULL
        AND t.deadline <= v_today + 1
        AND t.deadline >= v_today - 30   -- stop nagging about ancient tasks
      ORDER BY t.deadline
      LIMIT 500                          -- a runaway must not fan out unbounded
    ),
    claimed AS (
      INSERT INTO public.task_reminders (task_id, kind, sent_on)
      SELECT task_id, kind, v_today FROM due
      ON CONFLICT DO NOTHING
      RETURNING task_id, kind
    )
    SELECT task_id, kind FROM claimed
  LOOP
    -- Two headers, two jobs: the bearer gets past the edge gateway's verify_jwt, and the
    -- shared secret is what send-push itself checks. Recipients are worked out server-side
    -- from the task id, exactly as on the two user-triggered events.
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key,
        'x-reminder-secret', v_secret
      ),
      body := jsonb_build_object('event', 'reminder_' || r.kind, 'taskId', r.task_id),
      timeout_milliseconds := 10000
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Callable by nobody but the cron job, which runs as the function owner.
REVOKE EXECUTE ON FUNCTION public.dispatch_due_reminders(boolean) FROM public, anon, authenticated;

-- Guarded so that `supabase db reset` on a local stack without pg_cron does not fail the whole
-- migration. The extensions are enabled once from the dashboard; see the header.
DO $$
BEGIN
  IF to_regproc('cron.schedule') IS NULL THEN
    RAISE NOTICE 'pg_cron nije dostupan — preskačem raspored podsjetnika.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('deadline-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deadline-reminders');

  PERFORM cron.schedule(
    'deadline-reminders',
    '0 * * * *',
    'SELECT public.dispatch_due_reminders();'
  );
END $$;
