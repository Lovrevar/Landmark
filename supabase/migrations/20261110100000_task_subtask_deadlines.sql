/*
# A deadline per checklist line

Asked for by the crew using the mobile task app: "podzadatke u edit napravit da se mogu
dodavat, isto tako za podzadatke stavit individualne rokove". A construction checklist is a
sequence — iskop, armatura, betoniranje — and each step has its own date, while the task's
single `deadline` can only say when the whole thing is due.

## What changes
- `task_subtasks.deadline date NULL`. Informational: it paints a badge on the line. It is NOT
  read by dispatch_due_reminders(), so a line's date never sends a push; reminders stay per
  task, keyed (task_id, kind, sent_on) in task_reminders. Decided with the task app on
  2026-11-10; per-line reminders would need that table re-keyed and are a separate change.
- Both write RPCs read an optional "deadline" key from each p_subtasks element. The argument
  lists are unchanged (the date travels inside the jsonb), so this is CREATE OR REPLACE on
  the same signatures: no DROP, and the EXECUTE grants from 20260902110000 stay in place.

## The jsonb contract, extended
An element is now {"id": uuid|null, "title": text, "position": int, "deadline"?: date|null}.
The key is OPTIONAL, and on update the two cases differ on purpose:

    key absent          -> keep the line's stored deadline
    "deadline": null    -> clear it
    "deadline": "…"     -> set it ('' is treated as null)

A client bundle built before this migration sends {id, title, position} and nothing else;
treating that as "clear" would wipe every line's date the first time someone edited a task
from an old phone. The create RPC has no stored value to keep, so absent and null are the
same there.

## Nothing else moves
- No policy, grant or trigger change. There are no column-level grants on this table
  (deviation 1 in 20260902110000), so the new column is writable by whoever the row policies
  already admit: creator, assignee or admin. The sync trigger fires on UPDATE OF completed
  only, so changing a date never touches the parent.
- Cognilion's own client selects an explicit column list (SUBTASK_FIELDS) and does not show
  the date yet; it is unaffected either way.

## After applying
- Dev project first, then production, by hand (docs/SHARED_SCHEMA.md §12).
- `/db-types` here; `/schema-refresh` in the task app.
- The task app's TASK_SELECT embed will name this column, so its `main` must not deploy
  before production carries it: a missing column fails its whole workspace query.
*/

-- ---------- 1. the column ----------
ALTER TABLE public.task_subtasks ADD COLUMN IF NOT EXISTS deadline date;

COMMENT ON COLUMN public.task_subtasks.deadline IS
  'When this line is due. Informational only: shown on the line, never used by dispatch_due_reminders(). Set through p_subtasks on the task RPCs (key absent = keep, null = clear) or by a direct write.';

-- ---------- 2. create: a new line may carry its date ----------
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
  -- of the row just written above. An empty-string deadline is what a cleared <input
  -- type=date> yields, and it means "none".
  INSERT INTO public.task_subtasks (task_id, title, position, deadline)
  SELECT v_task_id,
         btrim(e->>'title'),
         coalesce((e->>'position')::int, (ord - 1)::int),
         nullif(e->>'deadline', '')::date
  FROM jsonb_array_elements(coalesce(p_subtasks, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord)
  WHERE btrim(coalesce(e->>'title', '')) <> '';

  RETURN v_task_id;
END;
$$;

-- ---------- 3. update: the moved arm learns the date, absent key keeps it ----------
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
  --
  -- has_deadline is whether the client sent the key at all. A bundle from before
  -- 20261110100000 never does, and its edits must leave every line's date exactly as it was.
  IF p_subtasks IS NOT NULL THEN
    WITH incoming AS (
      SELECT (e->>'id')::uuid                                AS id,
             btrim(e->>'title')                              AS title,
             coalesce((e->>'position')::int, (ord - 1)::int)  AS position,
             (e ? 'deadline')                                AS has_deadline,
             nullif(e->>'deadline', '')::date                AS deadline
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
    -- Renamed, moved or re-dated. completed / completed_at are untouched on purpose: that is
    -- the tick somebody made, and editing the task around it must not disturb it.
    moved AS (
      UPDATE public.task_subtasks s
      SET title    = i.title,
          position = i.position,
          deadline = CASE WHEN i.has_deadline THEN i.deadline ELSE s.deadline END
      FROM incoming i
      WHERE i.id = s.id AND s.task_id = p_task_id
        AND (s.title IS DISTINCT FROM i.title
             OR s.position IS DISTINCT FROM i.position
             OR (i.has_deadline AND s.deadline IS DISTINCT FROM i.deadline))
      RETURNING s.id
    )
    INSERT INTO public.task_subtasks (task_id, title, position, deadline)
    SELECT p_task_id, i.title, i.position, i.deadline FROM incoming i WHERE i.id IS NULL;
  END IF;

  RETURN p_task_id;
END;
$$;

-- Same signatures as 20260902110000, so CREATE OR REPLACE kept the existing grants:
-- EXECUTE revoked from public and granted to authenticated on both. Nothing to re-issue.
