/*
  # Calendar — Per-Occurrence RSVP

  Adds a sparse override layer so participants of a recurring event can accept or
  decline individual occurrences without affecting the rest of the series.

  1. New table: calendar_occurrence_responses
     Key (event_id, user_id, original_start_at) — mirrors the calendar_event_exceptions
     pattern. If no row exists for a given occurrence, the master participant row in
     calendar_event_participants governs the response.

  2. RLS: self-scoped — a participant can only read/write their own override.
     Creator visibility of participant responses remains via the master participants
     row, so we don't need to widen SELECT here.

  3. Realtime: added to supabase_realtime so the inbox widget and EventDetailModal
     stay live across tabs/devices.
*/

CREATE TABLE IF NOT EXISTS calendar_occurrence_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  original_start_at timestamptz NOT NULL,
  response text NOT NULL CHECK (response IN ('pending','accepted','declined')),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, original_start_at)
);

CREATE INDEX IF NOT EXISTS idx_occurrence_responses_user_start
  ON calendar_occurrence_responses (user_id, original_start_at);

CREATE INDEX IF NOT EXISTS idx_occurrence_responses_event
  ON calendar_occurrence_responses (event_id);

ALTER TABLE calendar_occurrence_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OccurrenceResponses: self-select"
  ON calendar_occurrence_responses FOR SELECT TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "OccurrenceResponses: self-insert"
  ON calendar_occurrence_responses FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    AND is_event_participant(
      event_id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "OccurrenceResponses: self-update"
  ON calendar_occurrence_responses FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "OccurrenceResponses: self-delete"
  ON calendar_occurrence_responses FOR DELETE TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'calendar_occurrence_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calendar_occurrence_responses;
  END IF;
END$$;
