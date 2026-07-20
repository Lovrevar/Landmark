/*
  # Tasks: compatibility with the standalone mobile task app

  A colleague's mobile app (schema in todoMigrations/, NOT to be applied
  here — its handle_new_user would clobber ours) is being pointed at this
  database. That app only knows auth user ids (auth.uid()) and a
  `profiles` table keyed by them, while our task tables referenced
  public.users(id) — a different UUID per person. This migration moves
  the whole tasks family into the auth-id space and adds the objects the
  mobile app expects.

  1. `public.profiles` — mirror of public.users keyed by auth_user_id.
     name = username, role mapped Director -> 'admin', else 'user'.
     Kept in sync by a trigger on public.users and by handle_new_user.
  2. `public.is_admin()` — as the mobile schema defines it (profiles
     role = 'admin', i.e. Directors).
  3. Task tables (`tasks.created_by`, `task_assignees.user_id`,
     `task_comments.user_id`, `task_attachments.uploaded_by`) migrate
     their values from users.id to users.auth_user_id and their FKs are
     repointed at profiles(id) under the SAME constraint names, so
     PostgREST embeds like `profiles!task_assignees_user_id_fkey`
     resolve. Rows owned by users without an auth account are nulled
     (tasks.created_by, task_attachments.uploaded_by) or deleted
     (task_assignees, task_comments) — they were unreachable via RLS
     anyway, since RLS always translated through auth_user_id.
  4. Column shape: `status` ('todo'|'done') becomes `completed` boolean;
     `due_date` is renamed `deadline`. `due_time`, `is_private`,
     `description_format`, `updated_at` stay (invisible to the mobile
     app). `created_by` drops NOT NULL (mobile shape; also needed for
     legacy rows). `project_id` deliberately stays NULLABLE — deviation
     from the mobile DDL agreed with the Director; the mobile app always
     sends a project on insert.
  5. RLS policies are recreated (same names) comparing auth.uid()
     directly. Deviations from the mobile app's own policies, on
     purpose:
     - SELECT keeps the is_private rule (mobile users don't see other
       people's private tasks) instead of USING (true).
     - INSERT requires created_by = auth.uid() (or NULL) instead of
       WITH CHECK (true) — compatible with the app, but no forgery.
     - UPDATE/DELETE add is_admin() so Directors can manage any task,
       which the mobile app expects.
  6. Adds the missing task_comments_task_id_fkey (comment embeds).

  Helper functions is_task_assignee / get_task_creator / can_view_task
  compare stored values and are ID-space agnostic — they need no change.

  NOTE: after applying, regenerate types with `npm run db:types`.
*/

-- ============================================================================
-- 1) profiles mirror table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.profiles (id, email, name, role, created_at)
SELECT
  u.auth_user_id,
  COALESCE(u.email, ''),
  COALESCE(u.username, split_part(u.email, '@', 1), 'user'),
  CASE WHEN u.role = 'Director' THEN 'admin' ELSE 'user' END,
  COALESCE(u.created_at, now())
FROM public.users u
WHERE u.auth_user_id IS NOT NULL
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name  = EXCLUDED.name,
      role  = EXCLUDED.role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Keep profiles in sync whenever public.users changes.
CREATE OR REPLACE FUNCTION public.sync_profile_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, created_at)
  VALUES (
    NEW.auth_user_id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.username, split_part(NEW.email, '@', 1), 'user'),
    CASE WHEN NEW.role = 'Director' THEN 'admin' ELSE 'user' END,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name  = EXCLUDED.name,
        role  = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_from_user ON public.users;
CREATE TRIGGER sync_profile_from_user
  AFTER INSERT OR UPDATE OF username, email, role, auth_user_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_user();

-- Extend handle_new_user (body unchanged except the profiles upsert).
-- The on_auth_user_created trigger on auth.users already exists on the
-- remote and keeps pointing at this function — do not touch the trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
new_username TEXT;
new_role TEXT;
BEGIN
-- Generate username from email or metadata
new_username := COALESCE(
NEW.raw_user_meta_data->>'username',
SPLIT_PART(NEW.email, '@', 1)
);

new_role := COALESCE(NEW.raw_app_meta_data->>'role', 'Sales')::TEXT;

-- Insert into public.users with generated username
-- If auth_user_id already exists, update the record
INSERT INTO public.users (auth_user_id, username, email, role, created_at)
VALUES (
NEW.id,
new_username,
NEW.email,
new_role,
NOW()
)
ON CONFLICT (auth_user_id) DO UPDATE
SET
email = EXCLUDED.email,
username = EXCLUDED.username,
role = EXCLUDED.role;

-- Mirror into profiles (mobile task app reads this table)
INSERT INTO public.profiles (id, email, name, role)
VALUES (
NEW.id,
COALESCE(NEW.email, ''),
new_username,
CASE WHEN new_role = 'Director' THEN 'admin' ELSE 'user' END
)
ON CONFLICT (id) DO UPDATE
SET
email = EXCLUDED.email,
name = EXCLUDED.name,
role = EXCLUDED.role;

RETURN NEW;
EXCEPTION
WHEN OTHERS THEN
-- Log error but don't fail authentication
RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
RETURN NEW;
END;
$$;

-- ============================================================================
-- 2) is_admin() — exactly as the mobile schema defines it
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================================
-- 3) Move task tables into the auth-id space
-- ============================================================================

-- Drop the old FKs first: the new values are not in users.id.
ALTER TABLE public.tasks            DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.task_assignees   DROP CONSTRAINT IF EXISTS task_assignees_user_id_fkey;
ALTER TABLE public.task_comments    DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;
ALTER TABLE public.task_attachments DROP CONSTRAINT IF EXISTS task_attachments_uploaded_by_fkey;

-- tasks.created_by: users.id -> auth_user_id (NULL when the user has no
-- auth account; the task itself stays).
ALTER TABLE public.tasks ALTER COLUMN created_by DROP NOT NULL;

UPDATE public.tasks t
SET created_by = u.auth_user_id
FROM public.users u
WHERE t.created_by = u.id;

UPDATE public.tasks t
SET created_by = NULL
WHERE t.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.created_by);

-- task_assignees.user_id: delete rows we cannot map (assignee without an
-- auth account could never log in to see the task anyway).
UPDATE public.task_assignees ta
SET user_id = u.auth_user_id
FROM public.users u
WHERE ta.user_id = u.id AND u.auth_user_id IS NOT NULL;

DELETE FROM public.task_assignees ta
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ta.user_id);

-- task_comments.user_id: same rule as assignees.
UPDATE public.task_comments tc
SET user_id = u.auth_user_id
FROM public.users u
WHERE tc.user_id = u.id AND u.auth_user_id IS NOT NULL;

DELETE FROM public.task_comments tc
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = tc.user_id);

-- task_attachments.uploaded_by: nullable, so unmapped uploaders go NULL.
UPDATE public.task_attachments ta
SET uploaded_by = u.auth_user_id
FROM public.users u
WHERE ta.uploaded_by = u.id;

UPDATE public.task_attachments ta
SET uploaded_by = NULL
WHERE ta.uploaded_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ta.uploaded_by);

-- Recreate the FKs against profiles under the same names (PostgREST
-- embeds resolve profiles through these constraint names).
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.task_comments
  ADD CONSTRAINT task_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.task_attachments
  ADD CONSTRAINT task_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Missing FK: comments -> tasks (only an index existed). Clean up any
-- orphans left by pre-FK deletes first.
DELETE FROM public.task_comments tc
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = tc.task_id);

ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey;
ALTER TABLE public.task_comments
  ADD CONSTRAINT task_comments_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- ============================================================================
-- 4) Column shape: status -> completed, due_date -> deadline
-- ============================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

UPDATE public.tasks SET completed = true WHERE status = 'done';

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS status;

ALTER TABLE public.tasks RENAME COLUMN due_date TO deadline;

-- ============================================================================
-- 5) RLS: same policy names, auth.uid() space, + admin rights
-- ============================================================================

-- ---- tasks ----
DROP POLICY IF EXISTS "Tasks: public visible to all, private to involved" ON public.tasks;
CREATE POLICY "Tasks: public visible to all, private to involved" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    (NOT is_private)
    OR created_by = auth.uid()
    OR public.is_task_assignee(id, auth.uid())
  );

DROP POLICY IF EXISTS "Tasks: owner can insert" ON public.tasks;
CREATE POLICY "Tasks: owner can insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "Tasks: creator or assignee can update" ON public.tasks;
CREATE POLICY "Tasks: creator or assignee can update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_task_assignee(id, auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_task_assignee(id, auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Tasks: creator can delete" ON public.tasks;
CREATE POLICY "Tasks: creator can delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- ---- task_assignees ----
DROP POLICY IF EXISTS "TaskAssignees: visible with task" ON public.task_assignees;
CREATE POLICY "TaskAssignees: visible with task" ON public.task_assignees
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));

DROP POLICY IF EXISTS "TaskAssignees: creator can insert" ON public.task_assignees;
CREATE POLICY "TaskAssignees: creator can insert" ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (public.get_task_creator(task_id) = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "TaskAssignees: creator can delete" ON public.task_assignees;
CREATE POLICY "TaskAssignees: creator can delete" ON public.task_assignees
  FOR DELETE TO authenticated
  USING (public.get_task_creator(task_id) = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "TaskAssignees: self can update acknowledgement" ON public.task_assignees;
CREATE POLICY "TaskAssignees: self can update acknowledgement" ON public.task_assignees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---- task_comments ----
DROP POLICY IF EXISTS "TaskComments: visible with task" ON public.task_comments;
CREATE POLICY "TaskComments: visible with task" ON public.task_comments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));

DROP POLICY IF EXISTS "TaskComments: assignees and creator can insert" ON public.task_comments;
CREATE POLICY "TaskComments: assignees and creator can insert" ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_task_assignee(task_id, user_id)
      OR public.get_task_creator(task_id) = user_id
    )
  );

DROP POLICY IF EXISTS "TaskComments: author can update" ON public.task_comments;
CREATE POLICY "TaskComments: author can update" ON public.task_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "TaskComments: author can delete" ON public.task_comments;
CREATE POLICY "TaskComments: author can delete" ON public.task_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---- task_attachments ----
DROP POLICY IF EXISTS "TaskAttachments: visible with task" ON public.task_attachments;
CREATE POLICY "TaskAttachments: visible with task" ON public.task_attachments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));

DROP POLICY IF EXISTS "TaskAttachments: assignees and creator can insert" ON public.task_attachments;
CREATE POLICY "TaskAttachments: assignees and creator can insert" ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.is_task_assignee(task_id, uploaded_by)
      OR public.get_task_creator(task_id) = uploaded_by
    )
  );

DROP POLICY IF EXISTS "TaskAttachments: uploader or task creator can delete" ON public.task_attachments;
CREATE POLICY "TaskAttachments: uploader or task creator can delete" ON public.task_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.get_task_creator(task_id) = auth.uid()
  );

-- ---- storage: task-attachments bucket ----
DROP POLICY IF EXISTS "TaskAttachments storage: read" ON storage.objects;
CREATE POLICY "TaskAttachments storage: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.task_attachments ta
      WHERE ta.storage_path = name
        AND public.can_view_task(ta.task_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "TaskAttachments storage: delete" ON storage.objects;
CREATE POLICY "TaskAttachments storage: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.task_attachments ta
      WHERE ta.storage_path = name
        AND (
          ta.uploaded_by = auth.uid()
          OR public.get_task_creator(ta.task_id) = auth.uid()
        )
    )
  );
