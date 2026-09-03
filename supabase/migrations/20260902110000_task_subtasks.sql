/*
# Subtasks — a second kind of task

Mirrors the subtasks feature shipped in the standalone mobile task app, which shares these
tables. Authored from that app's reference spec (taskManagerDocs/subtasks-schema.sql, which
this migration supersedes and which was never executed anywhere), adapted where Cognilion's
schema and client differ. Every deviation is called out below.

Supervisors were already writing checklists into the free-text description:

    1. gr dozvola - Petra
    2. troškovnici - Krešo, Domagoj
    3. tender - početak 14 dana, Krešo, Domagoj

and there was no way to cross one line off. `tasks.completed` is a single boolean for the
whole card, so a task like that stayed open until the last of six items was done and nobody
could see which ones already were.

## The two kinds, and why there is no `kind` column
A task with zero subtasks is a simple task; a task with one or more is a checklist. The kind
is *derived*, never stored. A `kind` column would be a second source of truth that can drift
from the rows it describes — a task marked 'checklist' with an empty list, or the reverse —
and every read site would then have to decide which of the two to believe.

## The parent completes itself
The trigger below flips `tasks.completed` when the last subtask is ticked, and flips it back
when one is un-ticked. That makes the parent checkbox on a checklist task a *readout*, not a
control — the client renders it disabled. Two switches wired to one lamp is the thing being
avoided; the subtasks win.

## Three deviations from the mobile reference

1. NO COLUMN-PRIVILEGE LOCKDOWN. The reference narrows privileges so the only direct write a
   client can make is the tick, and routes add/rename/reorder/remove through the RPCs. We do
   not do that here, for the same reason 20260813091000_task_edit_rpc.sql declines it for
   `tasks`: Cognilion never calls those RPCs. It writes tasks, task_assignees, task_comments
   and task_attachments with direct PostgREST calls, and the checklist editor in
   src/components/Tasks/components/SubtaskList.tsx does the same. A narrowed grant would fail
   a rename with "permission denied for table task_subtasks" while the row policy plainly
   allows the row. Supabase's stock role grants stand; the RLS policies below are the whole
   boundary.

   If Cognilion's task editor is ever refactored onto the RPCs, the reference's grants can be
   added in a follow-up — and remember that any column a later migration adds then needs its
   own GRANT or its own RPC.

2. SELECT IS GATED ON is_private. The reference's SELECT policy is `USING (true)`, which is
   correct in a schema with no such column. Ours has one, and the whole task-visibility story
   runs through can_view_task(); `USING (true)` here would publish the checklist titles of
   every private task to every authenticated user. This policy mirrors
   "TaskAssignees: visible with task" instead.

3. ASSIGNEES MAY EDIT THE LIST, not only the creator. The reference restricts add/rename/
   reorder/remove to the creator or an admin, matching its "only the creator may edit a task"
   rule. Cognilion's rule is wider — "Tasks: creator or assignee can update" — and its detail
   drawer already lets an assignee edit the title, description, deadline, project and colour
   inline. Making the checklist the one thing an assignee cannot touch would contradict the
   surrounding UI. Note this is wider than task_assignees, whose INSERT/DELETE stay
   creator-only: who is *on* a task remains the creator's call; what the work consists of
   does not.

The reference also cites 20260812091000_task_edit.sql — that is the mobile repo's filename.
The local counterpart is 20260813091000_task_edit_rpc.sql.

Regenerate the client types after applying: `npm run db:types`.
*/

-- ---------- 1. table ----------
CREATE TABLE IF NOT EXISTS public.task_subtasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title        text NOT NULL CHECK (btrim(title) <> ''),
  position     int  NOT NULL,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- A plain index, not UNIQUE (task_id, position). A reorder rewrites every position in one
-- statement, and a unique constraint would reject the intermediate state unless it were
-- DEFERRABLE — a constraint that only ever gets in the way. Order ties break on nothing in
-- particular, so the client sorts by (position, created_at).
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON public.task_subtasks(task_id, position);

-- ---------- 2. RLS ----------
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

-- Visible wherever the parent task is visible. can_view_task() is SECURITY DEFINER precisely
-- so a child table's policy can consult tasks without recursing through its RLS; the
-- assignees, comments and attachments policies all reach the parent the same way.
DROP POLICY IF EXISTS "Subtasks: visible with task" ON public.task_subtasks;
CREATE POLICY "Subtasks: visible with task" ON public.task_subtasks
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));

-- The write set is the same disjunction as "Tasks: creator or assignee can update", reached
-- through the parent row. One UPDATE policy covers both jobs: ticking a line and renaming or
-- reordering it. get_task_creator() is SECURITY DEFINER for the same non-recursion reason.
DROP POLICY IF EXISTS "Subtasks: creator or assignee can insert" ON public.task_subtasks;
CREATE POLICY "Subtasks: creator or assignee can insert" ON public.task_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_task_creator(task_id) = auth.uid()
    OR public.is_task_assignee(task_id, auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Subtasks: creator or assignee can update" ON public.task_subtasks;
CREATE POLICY "Subtasks: creator or assignee can update" ON public.task_subtasks
  FOR UPDATE TO authenticated
  USING (
    public.get_task_creator(task_id) = auth.uid()
    OR public.is_task_assignee(task_id, auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    public.get_task_creator(task_id) = auth.uid()
    OR public.is_task_assignee(task_id, auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Subtasks: creator or assignee can delete" ON public.task_subtasks;
CREATE POLICY "Subtasks: creator or assignee can delete" ON public.task_subtasks
  FOR DELETE TO authenticated
  USING (
    public.get_task_creator(task_id) = auth.uid()
    OR public.is_task_assignee(task_id, auth.uid())
    OR public.is_admin()
  );

-- ---------- 3. the parent follows its children ----------
CREATE OR REPLACE FUNCTION public.sync_task_completion_from_subtasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id   uuid;
  v_total     int;
  v_open      int;
  v_completed boolean;
BEGIN
  -- Branch on TG_OP rather than coalesce(NEW.task_id, OLD.task_id): outside its own operation
  -- each of NEW and OLD is an *unassigned* record, not a null one, and reading a field off it
  -- raises "record new is not assigned yet" instead of returning NULL.
  IF TG_OP = 'DELETE' THEN
    v_task_id := OLD.task_id;
  ELSE
    v_task_id := NEW.task_id;
  END IF;

  -- A cascade from tasks fires this once per subtask on the way down, and the parent is
  -- already gone by then. Nothing to sync, and the UPDATE below would match no rows anyway;
  -- returning early keeps a task delete O(1) statements instead of O(subtasks).
  SELECT completed INTO v_completed FROM public.tasks WHERE id = v_task_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE NOT completed)
    INTO v_total, v_open
  FROM public.task_subtasks WHERE task_id = v_task_id;

  IF v_total = 0 THEN
    -- The task just lost its last subtask, so it is a simple task again and its own checkbox
    -- governs. Do not touch completed here: whatever it was is what the user last chose.
    RETURN NULL;
  END IF;

  -- updated_at is set explicitly. Unlike the mobile schema, this table has an updated_at with
  -- no default and no trigger of its own — it is maintained by hand on every client write
  -- (see updateTask/updateTaskCompleted in src/components/Tasks/services/tasksService.ts), so
  -- a server-side flip that skipped it would leave the column lying.
  IF v_open = 0 AND NOT v_completed THEN
    UPDATE public.tasks
      SET completed = true, completed_at = now(), updated_at = now()
      WHERE id = v_task_id;
  ELSIF v_open > 0 AND v_completed THEN
    UPDATE public.tasks
      SET completed = false, completed_at = NULL, updated_at = now()
      WHERE id = v_task_id;
  END IF;
  -- Both arms are guarded on the value actually changing, so re-ticking an already-complete
  -- checklist never churns completed_at and never re-arms a reminder's idea of "done".

  RETURN NULL;
END;
$$;

-- SECURITY DEFINER, and here is the argument for it: by the time this runs, the write to
-- task_subtasks has already passed the policies above. The parent flip is a *consequence* of
-- an authorised write, not a new decision, and it must not then fail on a row policy the
-- ticker happens to fall outside. It writes completed/completed_at/updated_at and nothing
-- else — never a field anybody chose.
REVOKE EXECUTE ON FUNCTION public.sync_task_completion_from_subtasks() FROM public;

DROP TRIGGER IF EXISTS task_subtasks_sync_parent ON public.task_subtasks;
CREATE TRIGGER task_subtasks_sync_parent
  AFTER INSERT OR UPDATE OF completed OR DELETE ON public.task_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_completion_from_subtasks();

-- Note on reminders: flipping a task back to open re-arms dispatch_due_reminders() for the
-- following morning (20260813092000_deadline_reminders.sql), because its predicate is
-- evaluated fresh each run. Within a day nothing re-sends — task_reminders is keyed
-- (task_id, kind, sent_on). This is why docs/subtasks-backfill.sql skips completed tasks.

-- ---------- 4. the write RPCs learn about subtasks ----------
/*
Cognilion does not call either of these — it inserts and updates the tables directly. The
mobile app does, and its new bundle sends p_subtasks, so they are updated here because this
repo owns the schema.

p_subtasks is a jsonb array of {"id": uuid|null, "title": text, "position": int}. Three states
worth distinguishing, and that client relies on all three:

    NULL  -> "I do not know about subtasks", i.e. an older client bundle. Leave them alone.
    '[]'  -> "this is a simple task". Clear the list.
    [...] -> this is the list, in this order.

An `id` present means "this is the row you already have" and its `completed` is preserved; an
id of null means "new line". That distinction is the whole point of reconciling rather than
deleting and re-inserting: without it, changing a task's deadline would silently un-tick every
line somebody had crossed off.

CREATE OR REPLACE cannot change an argument list, so each function is dropped by its exact old
signature first. Migrations run in one transaction, so there is no window where the RPC is
missing. p_subtasks goes LAST and is DEFAULTed so a browser still running the old bundle keeps
saving tasks right through the deploy — and note that dropping a function drops its EXECUTE
grants with it, so those have to be re-issued against the new signature.

Argument names and order are a contract with the mobile client: PostgREST resolves overloads
by named arguments, so nothing here may be renamed or reordered. Append only.
*/

DROP FUNCTION IF EXISTS public.create_task_with_assignees(text, text, uuid, date, uuid[], text);

CREATE OR REPLACE FUNCTION public.create_task_with_assignees(
  p_title text,
  p_description text,
  p_project_id uuid,
  p_deadline date,
  p_assignee_ids uuid[],
  p_color text DEFAULT NULL,
  p_subtasks jsonb DEFAULT NULL
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

  -- Blank titles are dropped rather than rejected: an empty trailing row is what an editor
  -- with an "add line" button produces, and it is not worth an error message. SECURITY
  -- INVOKER, so this insert passes "Subtasks: creator or assignee can insert" as the creator
  -- of the row just written above.
  INSERT INTO public.task_subtasks (task_id, title, position)
  SELECT v_task_id, btrim(e->>'title'), coalesce((e->>'position')::int, (ord - 1)::int)
  FROM jsonb_array_elements(coalesce(p_subtasks, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord)
  WHERE btrim(coalesce(e->>'title', '')) <> '';

  RETURN v_task_id;
END;
$$;

-- This function had no explicit grants before, relying on the default EXECUTE to PUBLIC —
-- safe only because it is SECURITY INVOKER. Now that it is being recreated anyway, lock it
-- down the same way the DEFINER functions are.
REVOKE EXECUTE ON FUNCTION public.create_task_with_assignees(text, text, uuid, date, uuid[], text, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_task_with_assignees(text, text, uuid, date, uuid[], text, jsonb) TO authenticated;


DROP FUNCTION IF EXISTS public.update_task_with_assignees(uuid, text, text, uuid, date, text, uuid[]);

CREATE OR REPLACE FUNCTION public.update_task_with_assignees(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_project_id uuid,
  p_deadline date,
  p_color text,
  p_assignee_ids uuid[],
  p_subtasks jsonb DEFAULT NULL
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

  -- task_assignees has nothing worth updating here, so a reassignment is a set difference:
  -- drop whoever left, add whoever arrived, and leave the rows that did not change alone so
  -- they keep their original created_at — and, in this schema, their acknowledged_at.
  DELETE FROM public.task_assignees
  WHERE task_id = p_task_id AND NOT (assignee_id = ANY (v_assignees));

  INSERT INTO public.task_assignees (task_id, assignee_id)
  SELECT DISTINCT p_task_id, a FROM unnest(v_assignees) AS a
  ON CONFLICT DO NOTHING;

  -- Subtasks reconcile the same way, and for a stronger reason: an assignee's ticks live on
  -- these rows, so a row that survives the edit has to be the *same* row.
  --
  -- One statement rather than a temp table: pg_temp is implicitly searched ahead of the
  -- fixed search_path above, so a temp relation named inside a SECURITY DEFINER function is
  -- a name an unprivileged session can get in front of. A CTE has no such namespace. The
  -- three arms touch disjoint rows — absent / matched by id / new — so sharing one snapshot
  -- is exactly what is wanted.
  IF p_subtasks IS NOT NULL THEN
    WITH incoming AS (
      SELECT (e->>'id')::uuid                                AS id,
             btrim(e->>'title')                              AS title,
             coalesce((e->>'position')::int, (ord - 1)::int)  AS position
      FROM jsonb_array_elements(p_subtasks) WITH ORDINALITY AS t(e, ord)
      WHERE btrim(coalesce(e->>'title', '')) <> ''
    ),
    -- Gone: every line the client did not send back. `NOT IN` would swallow the whole
    -- predicate on a NULL id, so this is an anti-join instead.
    removed AS (
      DELETE FROM public.task_subtasks s
      WHERE s.task_id = p_task_id
        AND NOT EXISTS (SELECT 1 FROM incoming i WHERE i.id = s.id)
      RETURNING s.id
    ),
    -- Renamed or moved. completed / completed_at are untouched on purpose: that is the tick
    -- somebody made, and editing the task around it must not disturb it.
    moved AS (
      UPDATE public.task_subtasks s
      SET title = i.title, position = i.position
      FROM incoming i
      WHERE i.id = s.id AND s.task_id = p_task_id
        AND (s.title IS DISTINCT FROM i.title OR s.position IS DISTINCT FROM i.position)
      RETURNING s.id
    )
    INSERT INTO public.task_subtasks (task_id, title, position)
    SELECT p_task_id, i.title, i.position FROM incoming i WHERE i.id IS NULL;
  END IF;

  RETURN p_task_id;
END;
$$;

-- Same lock-down as save_push_subscription: a DEFINER function must not be executable by
-- anon, nor by any future role that happens to inherit from `public`.
REVOKE EXECUTE ON FUNCTION public.update_task_with_assignees(uuid, text, text, uuid, date, text, uuid[], jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.update_task_with_assignees(uuid, text, text, uuid, date, text, uuid[], jsonb) TO authenticated;
