/*
  # Calendar Redesign — Phase 4 (Reminders)

  1. New table
     - `calendar_notifications` — in-app notifications produced by the scheduled
       reminder dispatcher. One row per (event_id, user_id, occurrence_start_at,
       offset_minutes). Read + acknowledged by the recipient via the web client.

  2. RLS
     - SELECT / UPDATE (for acknowledge) limited to the recipient user.
     - DELETE limited to the recipient user (dismiss).
     - No client INSERT: rows are written by the Edge Function using the service
       role key, which bypasses RLS.

  3. Realtime
     - The table is added to the `supabase_realtime` publication so the client
       subscription (`postgres_changes` filtered by user_id) delivers reminders
       as toasts without polling.

  4. No new notifications table exists elsewhere in this repo (verified at
     implementation time), so this is the sole channel for calendar reminders.
*/

CREATE TABLE IF NOT EXISTS calendar_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  occurrence_start_at timestamptz NOT NULL,
  offset_minutes int NOT NULL,
  title text NOT NULL,
  body  text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendar_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_notifications_user_unread
  ON calendar_notifications(user_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_notifications_event
  ON calendar_notifications(event_id);

-- Recipient can read their own notifications.
CREATE POLICY "CalendarNotifications: recipient can view"
  ON calendar_notifications FOR SELECT TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- Recipient can acknowledge (sets acknowledged_at).
CREATE POLICY "CalendarNotifications: recipient can update"
  ON calendar_notifications FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- Recipient can delete (dismiss).
CREATE POLICY "CalendarNotifications: recipient can delete"
  ON calendar_notifications FOR DELETE TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- No INSERT policy — only the service role (Edge Function) writes here.

-- Enable realtime for client toast subscriptions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'calendar_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calendar_notifications;
  END IF;
END$$;
