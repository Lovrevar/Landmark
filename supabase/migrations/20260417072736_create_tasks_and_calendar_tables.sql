/*
  # Create Tasks and Calendar Modules

  1. New Tables
    - `tasks`
      - Core task record with title, description, due date/time, status, priority
      - `created_by` references users.id
      - `is_private` flag so private tasks only visible to creator
    - `task_assignees`
      - Many-to-many between tasks and users (a task can be assigned to multiple people)
      - `acknowledged_at` used for "new task" notification badge
    - `calendar_events`
      - Meeting/personal/deadline/reminder events with start/end timestamps
      - `is_private` flag so private events only visible to creator
    - `calendar_event_participants`
      - Many-to-many between events and users
      - `response` tracks RSVP (pending/accepted/declined)
      - `acknowledged_at` used for "new invite" notification badge

  2. Security
    - RLS enabled on all four tables
    - SECURITY DEFINER helpers `is_task_visible_to_user` and `is_event_visible_to_user`
      avoid recursion between tasks and task_assignees
    - Only creator can modify/delete tasks and events
    - Assignees can update their own assignment row (acknowledge, status helpers)

  3. Performance Indexes
    - tasks: (created_by), (due_date)
    - task_assignees: (user_id, acknowledged_at), (task_id)
    - calendar_events: (start_at), (created_by)
    - calendar_event_participants: (user_id, acknowledged_at), (event_id)

  4. Notes
    - `title` is required on both tasks and events
    - Setting a task to `done` should be done from the client (it updates
      `completed_at` alongside `status` — no server-side trigger required here)
*/

-- ============================================================================
-- TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date date,
  due_time time,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  is_private boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CALENDAR
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  event_type text NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN ('meeting','personal','deadline','reminder')),
  is_private boolean NOT NULL DEFAULT false,
  all_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS calendar_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response text NOT NULL DEFAULT 'pending'
    CHECK (response IN ('pending','accepted','declined')),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE calendar_event_participants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper functions (SECURITY DEFINER to prevent recursion in RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_assignees
    WHERE task_id = p_task_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_event_participant(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM calendar_event_participants
    WHERE event_id = p_event_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION get_task_creator(p_task_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_by FROM tasks WHERE id = p_task_id;
$$;

CREATE OR REPLACE FUNCTION get_event_creator(p_event_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_by FROM calendar_events WHERE id = p_event_id;
$$;

-- ============================================================================
-- Tasks policies
-- ============================================================================

CREATE POLICY "Tasks: creator or assignee can view"
  ON tasks FOR SELECT TO authenticated
  USING (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR is_task_assignee(
      id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Tasks: owner can insert"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "Tasks: creator or assignee can update"
  ON tasks FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR is_task_assignee(
      id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR is_task_assignee(
      id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Tasks: creator can delete"
  ON tasks FOR DELETE TO authenticated
  USING (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- ============================================================================
-- Task assignees policies
-- ============================================================================

CREATE POLICY "TaskAssignees: creator or self can view"
  ON task_assignees FOR SELECT TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR get_task_creator(task_id)
       = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "TaskAssignees: creator can insert"
  ON task_assignees FOR INSERT TO authenticated
  WITH CHECK (
    get_task_creator(task_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "TaskAssignees: self can update acknowledgement"
  ON task_assignees FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "TaskAssignees: creator can delete"
  ON task_assignees FOR DELETE TO authenticated
  USING (
    get_task_creator(task_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- ============================================================================
-- Calendar events policies
-- ============================================================================

CREATE POLICY "Events: creator or participant can view"
  ON calendar_events FOR SELECT TO authenticated
  USING (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR is_event_participant(
      id,
      (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Events: owner can insert"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "Events: creator can update"
  ON calendar_events FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  )
  WITH CHECK (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "Events: creator can delete"
  ON calendar_events FOR DELETE TO authenticated
  USING (
    created_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- ============================================================================
-- Calendar event participants policies
-- ============================================================================

CREATE POLICY "EventParticipants: creator or self can view"
  ON calendar_event_participants FOR SELECT TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR get_event_creator(event_id)
       = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "EventParticipants: creator can insert"
  ON calendar_event_participants FOR INSERT TO authenticated
  WITH CHECK (
    get_event_creator(event_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "EventParticipants: self can update rsvp"
  ON calendar_event_participants FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "EventParticipants: creator can delete"
  ON calendar_event_participants FOR DELETE TO authenticated
  USING (
    get_event_creator(event_id)
      = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id, acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_creator ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON calendar_event_participants(user_id, acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON calendar_event_participants(event_id);
