/*
# Per-task colour label

Mirrors 20260812090000_task_color.sql in the standalone mobile task app, which shares these
tables. A user-chosen colour, so a supervisor can group tasks by eye ("the blue ones are the
electrics"). It is a *label*, not a status: the red left border on an overdue row
(src/components/Tasks/TaskRow.tsx) stays driven by the deadline. That border is the safety
signal — whether a task is late — and it must not become something anyone can paint over.

## Why a closed set and not a hex string
Tailwind emits utility classes by scanning source files for literal class names, so a class
assembled at runtime (`bg-${color}-100`) is never generated and the chip would render with
no background at all. The palette is therefore closed on both ends: this CHECK constraint,
and COLOR_STYLES in src/components/Tasks/taskColor.ts. The two lists have to be changed
together, and the mobile app's src/lib/taskColor.ts is a third copy of the same list.

## Why NULL rather than a 'none' sentinel
NULL means "no colour", so existing rows need no backfill and the column needs no default —
a CHECK only fails when it evaluates to false, and NULL passes it.
*/

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_color_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_color_check
  CHECK (color IN ('blue','green','yellow','red','purple','gray'));

-- Nothing filters or sorts by colour, so no index. If a "show only blue" filter ever ships,
-- a partial index (WHERE color IS NOT NULL) is the thing to add.

-- create_task_with_assignees is the mobile app's create path (Cognilion inserts directly,
-- see createTask in src/components/Tasks/services/tasksService.ts). CREATE OR REPLACE cannot
-- change an argument list, so the 5-argument version is dropped first. Migrations run in one
-- transaction, so there is no window where the RPC is missing. p_color is added LAST and
-- DEFAULTed so a client bundle still calling with the old five named arguments keeps working
-- through the deploy.
DROP FUNCTION IF EXISTS public.create_task_with_assignees(text, text, uuid, date, uuid[]);

CREATE OR REPLACE FUNCTION public.create_task_with_assignees(
  p_title text,
  p_description text,
  p_project_id uuid,
  p_deadline date,
  p_assignee_ids uuid[],
  p_color text DEFAULT NULL
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
  INSERT INTO public.tasks (title, description, project_id, deadline, color, created_by)
  VALUES (p_title, coalesce(p_description, ''), p_project_id, p_deadline, p_color, auth.uid())
  RETURNING id INTO v_task_id;

  INSERT INTO public.task_assignees (task_id, assignee_id)
  SELECT DISTINCT v_task_id, a FROM unnest(p_assignee_ids) AS a;

  RETURN v_task_id;
END;
$$;
