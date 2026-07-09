/*
  # Simplify task management

  Product decision (Director feedback): the tasks tool was too complex.
  This migration backs the simplified UI:

  1. Status is binary — `todo` | `done`. All existing `in_progress`
     ("u tijeku") rows are INTENTIONALLY downgraded to `todo` (open);
     their `completed_at` is already NULL so nothing else changes.
  2. Reminders are removed entirely. `tasks.reminder_offsets` and the
     `task_reminder_sends` table were dead weight — no dispatcher was
     ever built (only calendar events have one).
  3. `tasks.priority` is dropped — it never had a UI and every row is
     'normal'.
  4. Visibility broadens: every authenticated user can SEE all
     non-private tasks (and their assignees / comments / attachments,
     including attachment downloads). Private tasks stay visible only
     to their creator and assignees. Editing rights are UNCHANGED:
     UPDATE stays creator-or-assignee, INSERT/DELETE stay creator-only,
     comment/attachment INSERT stays assignee-or-creator.
  5. The legacy permissive policy "Allow all operations on
     task_comments" is dropped — it predates the per-role policies and
     made them moot. This is a real tightening; comment flows are
     covered by the manual smoke tests in docs/test/08-collaboration.md.

  NOTE: after applying, regenerate types with `npm run db:types`
  (the task service uses untyped .from() calls, so the app works
  either way).

  All drops are guarded with IF EXISTS / OR REPLACE because the remote
  schema has drifted from the baseline capture (e.g. task_reminder_sends
  was found missing on the remote during the first push attempt).
*/

-- 1) Binary status ----------------------------------------------------------

UPDATE public.tasks
SET status = 'todo', updated_at = now()
WHERE status = 'in_progress';

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status = ANY (ARRAY['todo'::text, 'done'::text]));

-- 2) Remove reminders --------------------------------------------------------

ALTER TABLE public.tasks DROP COLUMN IF EXISTS reminder_offsets;
DROP TABLE IF EXISTS public.task_reminder_sends; -- drops its RLS policy with it

-- 3) Remove priority ---------------------------------------------------------

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS priority;

-- 4) Visibility helper -------------------------------------------------------

-- SECURITY DEFINER so child-table policies (assignees/comments/attachments/
-- storage) can consult tasks without recursing through tasks' own RLS.
CREATE OR REPLACE FUNCTION public.can_view_task(p_task_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
SELECT EXISTS (
SELECT 1 FROM tasks t
WHERE t.id = p_task_id
  AND ((NOT t.is_private)
    OR t.created_by = p_user_id
    OR is_task_assignee(t.id, p_user_id))
);
$$;

-- 5) Broaden SELECT policies -------------------------------------------------

-- tasks: public tasks visible to everyone; private only to involved users
DROP POLICY IF EXISTS "Tasks: creator or assignee can view" ON public.tasks;

CREATE POLICY "Tasks: public visible to all, private to involved" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    (NOT is_private)
    OR (created_by = ( SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()))
    OR public.is_task_assignee(id, ( SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()))
  );

-- task_assignees: visible wherever the parent task is visible
DROP POLICY IF EXISTS "TaskAssignees: creator or self can view" ON public.task_assignees;

CREATE POLICY "TaskAssignees: visible with task" ON public.task_assignees
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, ( SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid())));

-- task_comments: drop the legacy allow-all policy AND the narrow view policy,
-- replace with task-visibility SELECT
DROP POLICY IF EXISTS "Allow all operations on task_comments" ON public.task_comments;
DROP POLICY IF EXISTS "TaskComments: assignees and creator can view" ON public.task_comments;

CREATE POLICY "TaskComments: visible with task" ON public.task_comments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, ( SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid())));

-- task_attachments: visible wherever the parent task is visible
DROP POLICY IF EXISTS "TaskAttachments: assignees and creator can view" ON public.task_attachments;

CREATE POLICY "TaskAttachments: visible with task" ON public.task_attachments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, ( SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid())));

-- storage: attachment downloads follow task visibility
DROP POLICY IF EXISTS "TaskAttachments storage: read" ON storage.objects;

CREATE POLICY "TaskAttachments storage: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.task_attachments ta
      WHERE ta.storage_path = name
        AND public.can_view_task(ta.task_id, (SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()))
    )
  );
