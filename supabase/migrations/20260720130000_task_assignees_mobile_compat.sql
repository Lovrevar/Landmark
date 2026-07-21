/*
  # task_assignees: align with the mobile app's multi-assignee schema

  Follow-up to 20260720120000_tasks_mobile_compat.sql. The mobile task app
  added multi-assignee support (todoMigrations/20260720120000_multi_assignee.sql,
  NOT to be applied here) with three expectations our table didn't meet:

  1. The assignee column is named `assignee_id` (ours was `user_id`).
  2. The junction's PRIMARY KEY is (task_id, assignee_id) — PostgREST only
     detects a table as an m2m junction (enabling the flat embed
     `assignees:profiles!task_assignees`) when both FK columns form the PK.
     Our surrogate `id` stays as a UNIQUE column because the web app
     deletes assignee rows by id.
  3. Task creation goes through the RPC `create_task_with_assignees(...)`,
     which must exist here with the same name and arguments. Recreated
     below adapted to our columns; SECURITY INVOKER keeps RLS in force.

  His migration's RLS changes need no counterpart: our policies are a
  superset (creator OR assignee OR admin for update; creator-or-admin for
  assignee rows). `acknowledged_at` stays — invisible to his app.
*/

-- 1) Rename the column and its FK constraint (embed-relevant name).
ALTER TABLE public.task_assignees RENAME COLUMN user_id TO assignee_id;
ALTER TABLE public.task_assignees
  RENAME CONSTRAINT task_assignees_user_id_fkey TO task_assignees_assignee_id_fkey;

-- 2) Composite PK so PostgREST treats the table as a junction. The old
--    unique(task_id, user_id) guaranteed no duplicate pairs, so the PK is
--    safe to add; it also makes that unique constraint redundant.
ALTER TABLE public.task_assignees DROP CONSTRAINT task_assignees_pkey;
ALTER TABLE public.task_assignees ADD PRIMARY KEY (task_id, assignee_id);
ALTER TABLE public.task_assignees ADD CONSTRAINT task_assignees_id_key UNIQUE (id);
ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_task_id_user_id_key;

CREATE INDEX IF NOT EXISTS idx_task_assignees_assignee
  ON public.task_assignees(assignee_id);

-- 3) Helper + policies that referenced user_id.
CREATE OR REPLACE FUNCTION public.is_task_assignee(p_task_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
SELECT EXISTS (
SELECT 1 FROM task_assignees
WHERE task_id = p_task_id AND assignee_id = p_user_id
);
$$;

DROP POLICY IF EXISTS "TaskAssignees: self can update acknowledgement" ON public.task_assignees;
CREATE POLICY "TaskAssignees: self can update acknowledgement" ON public.task_assignees
  FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid())
  WITH CHECK (assignee_id = auth.uid());

-- 4) RPC the mobile app calls to create a task + assignees atomically.
--    Same signature as the mobile schema; SECURITY INVOKER so our RLS
--    applies (created_by = auth.uid() passes the tasks insert policy, and
--    the assignee insert passes the creator check in-transaction).
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
