/*
  # Calendar Redesign — Phase 1 Foundation

  1. New columns on calendar_events
    - `project_id`       (uuid, nullable, FK → projects) link an event to a project
    - `recurrence`       (text, nullable) RFC 5545 RRULE string; client expands
    - `reminder_offsets` (int[], default '{}') minutes-before-start to fire reminders
    - `busy`             (boolean, default true) free/busy flag for team-calendar overlay

  2. Integrity
    - CHECK (end_at > start_at) — enforced at the DB level, matches client-side guard

  3. New tables
    - `calendar_event_exceptions`  — per-occurrence overrides for recurring events
                                     (V1 supports single-occurrence edit/cancel)
    - `calendar_reminder_sends`    — idempotency ledger for the reminder dispatcher
                                     (written by the scheduled Edge Function in Phase 4)

  4. Busy-blocks exposure
    - `get_busy_blocks(uuid[], timestamptz, timestamptz)` SECURITY DEFINER function
      returns only (user_id, start_at, end_at) rows for events where `busy = true`,
      so non-participants can see presence without leaking private details.<
      Base-table RLS on `calendar_events` stays strict — this RPC is the only
      surface through which non-participants observe busy/free.

  5. Indexes
    - (project_id), (start_at, end_at), and a partial index on recurring masters.

  6. Notes
    - No backfill required: new columns all have sensible defaults and existing
      rows satisfy `end_at > start_at` by construction (the old UI always set end
      from start).
    - RLS on the two new tables uses the existing helpers `get_event_creator()`
      and `is_event_participant()`.
*/

-- ============================================================================
-- calendar_events: new columns + CHECK
-- ============================================================================

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS reminder_offsets int[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS busy boolean NOT NULL DEFAULT true;

-- Backfill any legacy rows violating the new constraint. The old UI occasionally
-- produced `end_at <= start_at` (notably when end_date was left blank and end
-- defaulted to start). Bump those rows to a 30-minute duration so the CHECK
-- can be added without losing records.
UPDATE calendar_events
   SET end_at = start_at + INTERVAL '30 minutes'
 WHERE end_at <= start_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_calendar_events_end_after_start'
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT chk_calendar_events_end_after_start CHECK (end_at > start_at);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_calendar_events_project
  ON calendar_events(project_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_range
  ON calendar_events(start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_recurring
  ON calendar_events(created_by)
  WHERE recurrence IS NOT NULL;

-- ============================================================================
-- calendar_event_exceptions — per-occurrence overrides for recurring events
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_event_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  original_start_at timestamptz NOT NULL,
  override_start_at timestamptz,
  override_end_at   timestamptz,
  override_title    text,
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, original_start_at),
  CHECK (is_cancelled OR override_start_at IS NOT NULL),
  CHECK (override_end_at IS NULL OR override_start_at IS NULL OR override_end_at > override_start_at)
);

ALTER TABLE calendar_event_exceptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_event_exceptions_event
  ON calendar_event_exceptions(event_id);

CREATE POLICY "EventExceptions: creator or participant can view"
  ON calendar_event_exceptions FOR SELECT TO authenticated
  USING (
    get_event_creator(event_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR is_event_participant(
      event_id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "EventExceptions: creator can insert"
  ON calendar_event_exceptions FOR INSERT TO authenticated
  WITH CHECK (
    get_event_creator(event_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "EventExceptions: creator can update"
  ON calendar_event_exceptions FOR UPDATE TO authenticated
  USING (
    get_event_creator(event_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  )
  WITH CHECK (
    get_event_creator(event_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "EventExceptions: creator can delete"
  ON calendar_event_exceptions FOR DELETE TO authenticated
  USING (
    get_event_creator(event_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- ============================================================================
-- calendar_reminder_sends — idempotency ledger for the reminder dispatcher
-- (Phase 4 will write to this from a scheduled Edge Function via service role)
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offset_minutes int NOT NULL,
  occurrence_start_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, offset_minutes, occurrence_start_at)
);

ALTER TABLE calendar_reminder_sends ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_reminder_sends_lookup
  ON calendar_reminder_sends(event_id, occurrence_start_at);

-- No client access: only the service role (Edge Function) writes to this table.

-- ============================================================================
-- get_busy_blocks — free/busy overlay without leaking private event details
-- ============================================================================

CREATE OR REPLACE FUNCTION get_busy_blocks(
  p_user_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE (user_id uuid, start_at timestamptz, end_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT ep.user_id, e.start_at, e.end_at
  FROM calendar_events e
  JOIN calendar_event_participants ep ON ep.event_id = e.id
  WHERE e.busy = true
    AND ep.user_id = ANY(p_user_ids)
    AND e.start_at < p_to
    AND e.end_at   > p_from
  UNION
  SELECT e.created_by, e.start_at, e.end_at
  FROM calendar_events e
  WHERE e.busy = true
    AND e.created_by = ANY(p_user_ids)
    AND e.start_at < p_to
    AND e.end_at   > p_from;
$$;

GRANT EXECUTE ON FUNCTION get_busy_blocks(uuid[], timestamptz, timestamptz)
  TO authenticated;
