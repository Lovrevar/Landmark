-- Seed data for the Calendar module.
-- Paste into the Supabase SQL editor.
--
-- Re-runnable: every seeded event description starts with the `[calendar-seed]`
-- marker and the script deletes rows with that marker before inserting, so
-- re-running replaces the set cleanly. Participants, exceptions, and occurrence
-- responses cascade with the parent event.
--
-- Picks the first 3 users (by created_at) and first 2 projects (by name) from
-- the local DB. Replace the CTEs with fixed UUIDs if you need specific users.

BEGIN;

-- 1. Clean slate: drop previously seeded events (cascades to participants /
--    exceptions / occurrence_responses via FKs).
DELETE FROM calendar_events
 WHERE description LIKE '[calendar-seed]%';

-- 2. Insert events.
WITH
  u AS (
    SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM users
    LIMIT 3
  ),
  p AS (
    SELECT id, row_number() OVER (ORDER BY name) AS rn
    FROM projects
    LIMIT 2
  ),
  u1 AS (SELECT id FROM u WHERE rn = 1),
  u2 AS (SELECT id FROM u WHERE rn = 2),
  u3 AS (SELECT id FROM u WHERE rn = 3),
  p1 AS (SELECT id FROM p WHERE rn = 1),
  p2 AS (SELECT id FROM p WHERE rn = 2),
  inserted AS (
    INSERT INTO calendar_events
      (title, description, location, created_by, start_at, end_at,
       event_type, is_private, all_day, project_id, recurrence,
       reminder_offsets, busy)
    VALUES
      -- ====================================================================
      -- Past / today — grid anchor, RSVP history
      -- ====================================================================

      ('Kick-off retrospective',
        '[calendar-seed] Recap of last sprint. Focus on blockers from the site visit.',
        'Meeting Room A',
        (SELECT id FROM u1),
        (CURRENT_DATE - 3)::timestamp + TIME '10:00',
        (CURRENT_DATE - 3)::timestamp + TIME '11:00',
        'meeting', FALSE, FALSE, (SELECT id FROM p1), NULL,
        ARRAY[15, 60], TRUE),

      ('March financial close',
        '[calendar-seed] All accounts finalised for the month.',
        '',
        (SELECT id FROM u2),
        (CURRENT_DATE - 1)::timestamp + TIME '16:00',
        (CURRENT_DATE - 1)::timestamp + TIME '17:30',
        'deadline', FALSE, FALSE, (SELECT id FROM p2), NULL,
        ARRAY[1440], TRUE),

      ('Site walkthrough — Block C',
        '[calendar-seed] Bring hi-vis + tablet for punch-list photos.',
        'Block C, floor 3',
        (SELECT id FROM u1),
        CURRENT_DATE::timestamp + TIME '09:00',
        CURRENT_DATE::timestamp + TIME '10:30',
        'meeting', FALSE, FALSE, (SELECT id FROM p1), NULL,
        ARRAY[15, 60], TRUE),

      ('Lunch with investor (private)',
        '[calendar-seed] Informal — no deck.',
        'Restaurant TBD',
        (SELECT id FROM u3),
        CURRENT_DATE::timestamp + TIME '12:30',
        CURRENT_DATE::timestamp + TIME '14:00',
        'personal', TRUE, FALSE, NULL, NULL,
        ARRAY[30], FALSE),

      ('Daily standup',
        '[calendar-seed] 15-minute sync. Weekdays only.',
        'Zoom',
        (SELECT id FROM u1),
        CURRENT_DATE::timestamp + TIME '09:30',
        CURRENT_DATE::timestamp + TIME '09:45',
        'meeting', FALSE, FALSE, (SELECT id FROM p1),
        'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=20',
        ARRAY[5], FALSE),

      -- ====================================================================
      -- Tomorrow / this week
      -- ====================================================================

      ('Submit VAT return',
        '[calendar-seed] Deadline for the month. No meeting — reminder only.',
        '',
        (SELECT id FROM u2),
        (CURRENT_DATE + 1)::timestamp + TIME '17:00',
        (CURRENT_DATE + 1)::timestamp + TIME '17:30',
        'deadline', FALSE, FALSE, (SELECT id FROM p2), NULL,
        ARRAY[60, 1440], TRUE),

      ('Architect review — revised layouts',
        '[calendar-seed] Go through the red-lines from last week.',
        'Office, small room',
        (SELECT id FROM u1),
        (CURRENT_DATE + 2)::timestamp + TIME '11:00',
        (CURRENT_DATE + 2)::timestamp + TIME '12:30',
        'meeting', FALSE, FALSE, (SELECT id FROM p1), NULL,
        ARRAY[60], TRUE),

      ('Scaffolding inspection',
        '[calendar-seed] Safety officer confirmed.',
        'Block A — all floors',
        (SELECT id FROM u3),
        (CURRENT_DATE + 3)::timestamp + TIME '07:30',
        (CURRENT_DATE + 3)::timestamp + TIME '09:00',
        'meeting', FALSE, FALSE, (SELECT id FROM p1), NULL,
        ARRAY[30], TRUE),

      ('Dentist',
        '[calendar-seed] Personal — blocks busy overlay.',
        'Clinic Savska',
        (SELECT id FROM u2),
        (CURRENT_DATE + 3)::timestamp + TIME '15:00',
        (CURRENT_DATE + 3)::timestamp + TIME '16:00',
        'personal', TRUE, FALSE, NULL, NULL,
        ARRAY[120], TRUE),

      -- ====================================================================
      -- Multi-day / all-day
      -- ====================================================================

      ('Industry conference (out of office)',
        '[calendar-seed] Away from site Thursday–Saturday next week.',
        'Zagreb Fair Hall',
        (SELECT id FROM u1),
        (CURRENT_DATE + 10)::timestamp + TIME '00:00',
        (CURRENT_DATE + 13)::timestamp + TIME '00:00',
        'personal', FALSE, TRUE, NULL, NULL,
        ARRAY[1440], TRUE),

      -- ====================================================================
      -- Next week / later — recurrence + exceptions
      -- ====================================================================

      ('Weekly project sync',
        '[calendar-seed] Cross-team review. Recurring Mondays.',
        'Meeting Room B',
        (SELECT id FROM u2),
        (CURRENT_DATE + 7)::timestamp + TIME '14:00',
        (CURRENT_DATE + 7)::timestamp + TIME '15:00',
        'meeting', FALSE, FALSE, (SELECT id FROM p1),
        'FREQ=WEEKLY;COUNT=8',
        ARRAY[60, 1440], TRUE),

      ('Monthly investor update call',
        '[calendar-seed] 30-minute deck walk-through.',
        'Zoom',
        (SELECT id FROM u3),
        (CURRENT_DATE + 14)::timestamp + TIME '16:00',
        (CURRENT_DATE + 14)::timestamp + TIME '16:30',
        'meeting', FALSE, FALSE, (SELECT id FROM p2),
        'FREQ=MONTHLY;COUNT=6',
        ARRAY[1440, 10080], TRUE),

      ('Quarterly OKR planning',
        '[calendar-seed] Off-site in 3 weeks.',
        'Hotel Esplanade',
        (SELECT id FROM u1),
        (CURRENT_DATE + 21)::timestamp + TIME '09:00',
        (CURRENT_DATE + 21)::timestamp + TIME '17:00',
        'meeting', FALSE, FALSE, (SELECT id FROM p1), NULL,
        ARRAY[1440, 10080], TRUE),

      -- ====================================================================
      -- Reminders (no attendees, just me)
      -- ====================================================================

      ('Renew insurance policy',
        '[calendar-seed] Auto-reminder 1 week + 1 day before.',
        '',
        (SELECT id FROM u1),
        (CURRENT_DATE + 6)::timestamp + TIME '09:00',
        (CURRENT_DATE + 6)::timestamp + TIME '09:15',
        'reminder', FALSE, FALSE, NULL, NULL,
        ARRAY[1440, 10080], FALSE),

      ('Check backup restore drill',
        '[calendar-seed] Monthly — last Friday.',
        '',
        (SELECT id FROM u2),
        (CURRENT_DATE + 8)::timestamp + TIME '15:00',
        (CURRENT_DATE + 8)::timestamp + TIME '15:30',
        'reminder', FALSE, FALSE, NULL, NULL,
        ARRAY[60], FALSE)
    RETURNING id, title, created_by, is_private, start_at, recurrence
  )

-- 3. Participants: non-private events get a mixed RSVP spread across the 3 users.
INSERT INTO calendar_event_participants (event_id, user_id, response, acknowledged_at)
SELECT i.id, u.id,
       CASE
         WHEN u.id = i.created_by                 THEN 'accepted'::text
         WHEN i.title = 'Kick-off retrospective'  AND u.rn = 2 THEN 'accepted'
         WHEN i.title = 'Kick-off retrospective'  AND u.rn = 3 THEN 'declined'
         WHEN i.title LIKE 'March financial%'     AND u.rn = 1 THEN 'accepted'
         WHEN i.title LIKE 'Site walkthrough%'    AND u.rn = 2 THEN 'accepted'
         WHEN i.title LIKE 'Site walkthrough%'    AND u.rn = 3 THEN 'pending'
         WHEN i.title = 'Daily standup'           AND u.rn IN (2, 3) THEN 'accepted'
         WHEN i.title LIKE 'Submit VAT%'          AND u.rn = 1 THEN 'pending'
         WHEN i.title LIKE 'Architect review%'    AND u.rn IN (2, 3) THEN 'pending'
         WHEN i.title LIKE 'Scaffolding%'         AND u.rn IN (1, 2) THEN 'accepted'
         WHEN i.title LIKE 'Industry conference%' AND u.rn = 2 THEN 'accepted'
         WHEN i.title LIKE 'Industry conference%' AND u.rn = 3 THEN 'declined'
         WHEN i.title LIKE 'Weekly project sync%' AND u.rn IN (1, 3) THEN 'pending'
         WHEN i.title LIKE 'Monthly investor%'    AND u.rn IN (1, 2) THEN 'accepted'
         WHEN i.title LIKE 'Quarterly OKR%'       AND u.rn IN (2, 3) THEN 'pending'
         ELSE NULL
       END AS response,
       CASE
         WHEN u.id = i.created_by THEN i.start_at  -- creator is acknowledged
         WHEN i.title IN ('Kick-off retrospective', 'March financial close',
                          'Site walkthrough — Block C', 'Daily standup',
                          'Scaffolding inspection', 'Industry conference (out of office)',
                          'Monthly investor update call')
           THEN NOW()
         ELSE NULL  -- unread → shows up in the header badge
       END AS acknowledged_at
FROM inserted i
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM users LIMIT 3
) u
WHERE i.is_private = FALSE
  AND (
    u.id = i.created_by
    OR (
      CASE
        WHEN i.title = 'Kick-off retrospective'  AND u.rn IN (2, 3) THEN TRUE
        WHEN i.title LIKE 'March financial%'     AND u.rn = 1 THEN TRUE
        WHEN i.title LIKE 'Site walkthrough%'    AND u.rn IN (2, 3) THEN TRUE
        WHEN i.title = 'Daily standup'           AND u.rn IN (2, 3) THEN TRUE
        WHEN i.title LIKE 'Submit VAT%'          AND u.rn = 1 THEN TRUE
        WHEN i.title LIKE 'Architect review%'    AND u.rn IN (2, 3) THEN TRUE
        WHEN i.title LIKE 'Scaffolding%'         AND u.rn IN (1, 2) THEN TRUE
        WHEN i.title LIKE 'Industry conference%' AND u.rn IN (2, 3) THEN TRUE
        WHEN i.title LIKE 'Weekly project sync%' AND u.rn IN (1, 3) THEN TRUE
        WHEN i.title LIKE 'Monthly investor%'    AND u.rn IN (1, 2) THEN TRUE
        WHEN i.title LIKE 'Quarterly OKR%'       AND u.rn IN (2, 3) THEN TRUE
        ELSE FALSE
      END
    )
  );

-- 4. Private events: creator is their own sole participant, auto-accepted.
INSERT INTO calendar_event_participants (event_id, user_id, response, acknowledged_at)
SELECT e.id, e.created_by, 'accepted', NOW()
FROM calendar_events e
WHERE e.is_private = TRUE
  AND e.description LIKE '[calendar-seed]%'
  AND NOT EXISTS (
    SELECT 1 FROM calendar_event_participants ep
    WHERE ep.event_id = e.id AND ep.user_id = e.created_by
  );

-- 5. Recurring exceptions on "Weekly project sync":
--    cancel the 3rd occurrence, reschedule the 5th by 90 minutes.
INSERT INTO calendar_event_exceptions
  (event_id, original_start_at, override_start_at, override_end_at, override_title, is_cancelled)
SELECT e.id,
       e.start_at + INTERVAL '14 days',  -- 3rd occurrence
       NULL, NULL, NULL, TRUE
FROM calendar_events e
WHERE e.title = 'Weekly project sync'
  AND e.description LIKE '[calendar-seed]%';

INSERT INTO calendar_event_exceptions
  (event_id, original_start_at, override_start_at, override_end_at, override_title, is_cancelled)
SELECT e.id,
       e.start_at + INTERVAL '28 days',  -- 5th occurrence
       e.start_at + INTERVAL '28 days' + INTERVAL '90 minutes',
       e.end_at   + INTERVAL '28 days' + INTERVAL '90 minutes',
       'Weekly project sync (rescheduled)',
       FALSE
FROM calendar_events e
WHERE e.title = 'Weekly project sync'
  AND e.description LIKE '[calendar-seed]%';

-- 6. Per-occurrence RSVP override: decline next week's standup only.
INSERT INTO calendar_occurrence_responses
  (event_id, user_id, original_start_at, response, acknowledged_at)
SELECT e.id, ep.user_id, e.start_at + INTERVAL '7 days', 'declined', NOW()
FROM calendar_events e
JOIN calendar_event_participants ep ON ep.event_id = e.id
WHERE e.title = 'Daily standup'
  AND e.description LIKE '[calendar-seed]%'
  AND ep.user_id <> e.created_by
LIMIT 1;

COMMIT;
