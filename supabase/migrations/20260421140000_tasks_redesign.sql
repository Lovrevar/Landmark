/*
  # Tasks redesign

  Extends the Tasks module to parity with the redesigned Calendar.

  1. Schema changes on `tasks`
     - `project_id` — optional link to projects (for filters + grouping + calendar overlay)
     - `reminder_offsets` — minutes before `due_date` for the reminder dispatcher (mirrors calendar_events)
     - `description_format` — 'markdown' | 'plain' (new default: markdown)
     - Status CHECK simplified: drop 'cancelled', keep 'todo' | 'in_progress' | 'done'
     - Indexes on project_id and due_date

  2. New `task_attachments` table
     - Same shape as the chat attachments pattern; 25 MB / 10 files enforced client-side
     - Private Storage bucket `task-attachments`
     - RLS: read/insert/delete gated via is_task_assignee + get_task_creator
     - Added to supabase_realtime

  3. New `task_reminder_sends` table
     - Idempotency for the future `dispatch-task-reminders` Edge Function
     - (task_id, offset_min) unique

  4. Fix `task_comments.user_id` FK
     - Previously referenced auth.users(id); the rest of the tasks module uses public.users(id)
     - Dev stage: truncate any existing rows, swap the FK, update RLS to match the public-user pattern
*/

-- ============================================================================
-- TASKS: columns + status cleanup
-- ============================================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_offsets integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description_format text NOT NULL DEFAULT 'markdown'
    CHECK (description_format IN ('markdown','plain'));

UPDATE tasks SET status = 'done' WHERE status = 'cancelled';

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo','in_progress','done'));

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_nonnull
  ON tasks(due_date) WHERE due_date IS NOT NULL;

-- ============================================================================
-- TASK_ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TaskAttachments: assignees and creator can view"
  ON task_attachments FOR SELECT TO authenticated
  USING (
    is_task_assignee(task_id, (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()))
    OR get_task_creator(task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "TaskAttachments: assignees and creator can insert"
  ON task_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    AND (
      is_task_assignee(task_id, uploaded_by)
      OR get_task_creator(task_id) = uploaded_by
    )
  );

CREATE POLICY "TaskAttachments: uploader or task creator can delete"
  ON task_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    OR get_task_creator(task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE task_attachments;

-- Private Storage bucket for uploads.
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage-level RLS: uploader can read their own uploads and anyone who can see
-- the parent task (assignee or creator) can read + delete them.
CREATE POLICY "TaskAttachments storage: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM task_attachments ta
      WHERE ta.storage_path = name
        AND (
          is_task_assignee(ta.task_id, (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()))
          OR get_task_creator(ta.task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
        )
    )
  );

CREATE POLICY "TaskAttachments storage: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "TaskAttachments storage: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM task_attachments ta
      WHERE ta.storage_path = name
        AND (
          ta.uploaded_by = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
          OR get_task_creator(ta.task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
        )
    )
  );

-- ============================================================================
-- TASK_REMINDER_SENDS (idempotency for upcoming dispatch-task-reminders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  offset_min integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, offset_min)
);

CREATE INDEX IF NOT EXISTS idx_task_reminder_sends_task ON task_reminder_sends(task_id);

ALTER TABLE task_reminder_sends ENABLE ROW LEVEL SECURITY;

-- Only the dispatcher (service role) writes here; authenticated users don't need access.
-- Keep a read-only policy so logs can surface in admin views if desired.
CREATE POLICY "TaskReminderSends: authenticated can view own"
  ON task_reminder_sends FOR SELECT TO authenticated
  USING (
    is_task_assignee(task_id, (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()))
    OR get_task_creator(task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

-- ============================================================================
-- TASK_COMMENTS: swap user_id FK to public.users and rebuild RLS
-- ============================================================================

-- Dev stage: remove any existing rows so the FK swap cannot fail on legacy data.
TRUNCATE TABLE task_comments;

-- Drop inherited auth.users FK. The exact constraint name depends on Postgres;
-- find it dynamically rather than hard-coding the generated name.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.task_comments'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[
      (SELECT attnum FROM pg_attribute
       WHERE attrelid = 'public.task_comments'::regclass AND attname = 'user_id')
    ];
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE task_comments DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Rebuild RLS to resolve user via public.users instead of auth.uid() directly.
DROP POLICY IF EXISTS "Users can read comments on their tasks" ON task_comments;
DROP POLICY IF EXISTS "Users can create comments on their tasks" ON task_comments;
DROP POLICY IF EXISTS "Comment author can update own comments" ON task_comments;
DROP POLICY IF EXISTS "Comment author can delete own comments" ON task_comments;

CREATE POLICY "TaskComments: assignees and creator can view"
  ON task_comments FOR SELECT TO authenticated
  USING (
    is_task_assignee(task_id, (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()))
    OR get_task_creator(task_id) = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
  );

CREATE POLICY "TaskComments: assignees and creator can insert"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid())
    AND (
      is_task_assignee(task_id, user_id)
      OR get_task_creator(task_id) = user_id
    )
  );

CREATE POLICY "TaskComments: author can update"
  ON task_comments FOR UPDATE TO authenticated
  USING (user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "TaskComments: author can delete"
  ON task_comments FOR DELETE TO authenticated
  USING (user_id = (SELECT u.id FROM users u WHERE u.auth_user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;
