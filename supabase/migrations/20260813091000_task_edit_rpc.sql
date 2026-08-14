/*
# Editing a task after it has been created

Mirrors 20260812091000_task_edit.sql in the standalone mobile task app, which shares these
tables. Until now the only write path in that app was the completion toggle; it now has an
edit screen, and this is the RPC behind it.

## The rule this function establishes
  - admin or creator: may change everything — title, description, project, deadline, colour,
    assignees — through update_task_with_assignees().
  - assignee: may only flip the task between done and not done.
  - delete: unchanged (creator or admin, "Tasks: creator can delete").

## One deliberate deviation from the mobile migration
That migration also narrows the column privileges:

    REVOKE UPDATE ON public.tasks FROM authenticated;
    GRANT  UPDATE (completed, completed_at) ON public.tasks TO authenticated;

so that its client cannot write anything but the toggle directly. We do NOT do that here.
Cognilion's task detail drawer (src/components/Tasks/TaskDetail.tsx) autosaves every field
with a direct PATCH — title, description, project, deadline, is_private, and updated_at on
every save, the completion toggle included — so the narrowed grant would break the editor and
the toggle with "permission denied for table tasks". The RPC's own authorisation check below
is what enforces "only creator or admin may edit" for the callers that use it; Cognilion keeps
the row policy's wider rule ("creator or assignee may edit") for its inline editing.

If Cognilion's editor is ever refactored to go through this RPC, add the two statements above
in a follow-up migration — and remember that any column a later migration adds then needs its
own GRANT or its own RPC.

## Why no policy change
The mobile migration also replaces its `tasks_update_all` policy with `tasks_update_involved`,
because its original policy allowed assignees and admins but not the creator. This database
does not have that bug: "Tasks: creator or assignee can update" from
20260720120000_tasks_mobile_compat.sql already ORs creator, assignee and is_admin(), on both
USING and WITH CHECK. Adding a second permissive policy would only duplicate it.
*/

-- SECURITY DEFINER, because it must be able to write columns regardless of how the grants on
-- `tasks` are configured on either side of the shared schema — and therefore an explicit
-- authorisation check, because DEFINER also bypasses RLS.
--
-- The argument list matches the mobile app's rpc() call name-for-name and position-for-
-- position: PostgREST resolves overloads by named arguments, so renaming or reordering any of
-- these breaks that client.
CREATE OR REPLACE FUNCTION public.update_task_with_assignees(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_project_id uuid,
  p_deadline date,
  p_color text,
  p_assignee_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_by uuid;
  -- NULL is cast explicitly: array_remove is polymorphic, and an untyped NULL gives it
  -- nothing to resolve anyelement from.
  v_assignees uuid[] := array_remove(coalesce(p_assignee_ids, '{}'::uuid[]), NULL::uuid);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Niste prijavljeni.';
  END IF;

  IF cardinality(v_assignees) = 0 THEN
    RAISE EXCEPTION 'Zadatak mora imati barem jednog zaduženog.';
  END IF;

  -- FOR UPDATE: two supervisors editing the same task from two phones serialise here rather
  -- than racing each other through the assignee delete/insert below.
  SELECT created_by INTO v_created_by
  FROM public.tasks WHERE id = p_task_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zadatak ne postoji.';
  END IF;

  IF NOT (public.is_admin() OR v_created_by = auth.uid()) THEN
    RAISE EXCEPTION 'Zadatak može urediti samo osoba koja ga je stvorila ili admin.';
  END IF;

  UPDATE public.tasks
  SET title       = p_title,
      description = coalesce(p_description, ''),
      project_id  = p_project_id,
      deadline    = p_deadline,
      color       = p_color,
      updated_at  = now()
  WHERE id = p_task_id;

  -- task_assignees has no UPDATE policy and nothing worth updating, so a reassignment is a set
  -- difference: drop whoever left, add whoever arrived, and leave the rows that did not change
  -- alone so they keep their original created_at — and, in this schema, their acknowledged_at.
  DELETE FROM public.task_assignees
  WHERE task_id = p_task_id AND NOT (assignee_id = ANY (v_assignees));

  INSERT INTO public.task_assignees (task_id, assignee_id)
  SELECT DISTINCT p_task_id, a FROM unnest(v_assignees) AS a
  ON CONFLICT DO NOTHING;

  RETURN p_task_id;
END;
$$;

-- Same lock-down as save_push_subscription: a DEFINER function must not be executable by anon,
-- nor by any future role that happens to inherit from `public`.
REVOKE EXECUTE ON FUNCTION public.update_task_with_assignees(uuid, text, text, uuid, date, text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.update_task_with_assignees(uuid, text, text, uuid, date, text, uuid[]) TO authenticated;
