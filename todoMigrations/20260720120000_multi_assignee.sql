/*
# Multiple assignees per task

- New join table `task_assignees`; existing single assignees are backfilled from
  `tasks.assignee_id` before that column is dropped.
- `tasks_update_all` becomes a membership check (EXISTS against task_assignees).
- RPC `create_task_with_assignees` inserts the task and its assignee rows in one
  transaction and enforces at least one assignee.
- Behavior change: deleting a user no longer cascade-deletes their tasks, only
  their membership rows. A task can therefore end up with zero assignees when a
  user is deleted; admins can still manage it.
*/

-- 1. Join table. Both FK columns form the PK so PostgREST detects the table as
--    a junction and supports the flat embed `assignees:profiles!task_assignees`.
CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, assignee_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_assignee
  ON public.task_assignees(assignee_id);

-- 2. Backfill existing single assignees before the column is dropped.
INSERT INTO public.task_assignees (task_id, assignee_id)
SELECT id, assignee_id FROM public.tasks
ON CONFLICT DO NOTHING;

-- 3. RLS. SELECT policies here and on tasks are constant-true, so the mutual
--    policy references between tasks and task_assignees cannot recurse.
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_assignees_select_all" ON public.task_assignees;
CREATE POLICY "task_assignees_select_all"
  ON public.task_assignees FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "task_assignees_insert_creator_admin" ON public.task_assignees;
CREATE POLICY "task_assignees_insert_creator_admin"
  ON public.task_assignees FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_assignees_delete_creator_admin" ON public.task_assignees;
CREATE POLICY "task_assignees_delete_creator_admin"
  ON public.task_assignees FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.created_by = auth.uid()
    )
  );

-- 4. Replace the update policy before dropping assignee_id (it references it).
DROP POLICY IF EXISTS "tasks_update_all" ON public.tasks;
CREATE POLICY "tasks_update_all"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.assignee_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.assignee_id = auth.uid()
    )
  );

-- 5. Drop the old column (also drops tasks_assignee_id_fkey and idx_tasks_assignee).
ALTER TABLE public.tasks DROP COLUMN IF EXISTS assignee_id;

-- 6. Atomic create. SECURITY INVOKER keeps RLS in force for both inserts; the
--    task_assignees insert passes the creator policy because created_by =
--    auth.uid() within the same transaction.
CREATE OR REPLACE FUNCTION public.create_task_with_assignees(
  p_title text,
  p_description text,
  p_project_id uuid,
  p_deadline date,
  p_assignee_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
BEGIN
  IF p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0 THEN
    RAISE EXCEPTION 'Zadatak mora imati barem jednog zaduženog.';
  END IF;

  -- description is NOT NULL in the schema; treat a missing description as ''.
  INSERT INTO public.tasks (title, description, project_id, deadline, created_by)
  VALUES (p_title, coalesce(p_description, ''), p_project_id, p_deadline, auth.uid())
  RETURNING id INTO v_task_id;

  INSERT INTO public.task_assignees (task_id, assignee_id)
  SELECT DISTINCT v_task_id, a FROM unnest(p_assignee_ids) AS a;

  RETURN v_task_id;
END;
$$;
