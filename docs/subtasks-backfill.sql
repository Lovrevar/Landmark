/*
# Backfill, step 2 of 2: the WRITE.

Run docs/subtasks-backfill-preview.sql FIRST and read its output. This file applies exactly
what that one showed, using the same CTE (kept verbatim in both — change one, change both).

It is wrapped in an explicit transaction. Run it as one statement batch: if the row counts
are not what the preview promised, ROLLBACK instead of COMMIT.

What it does, per converted task:
  1. inserts the list items as task_subtasks rows, in order, all unticked;
  2. replaces the description with whatever text sat above the list (usually nothing).

Tasks that are completed, have no list, or already have subtasks are not touched.

## Ordering
Run AFTER supabase/migrations/20260902110000_task_subtasks.sql. Step 1 fires the
task_subtasks_sync_parent trigger once per inserted row; because only open tasks are
converted (`AND NOT t.completed` in the `lines` CTE) the trigger has nothing to flip — every
converted task is already open and stays open until somebody ticks its lines.

That predicate is the deliberate divergence from the mobile app's reference version, which
converts completed tasks too and reopens them. Reopening is the honest state there, but here
a reopened task with a deadline in the last 30 days is claimed by dispatch_due_reminders()
the next morning and pushed to its assignees — see the preview file's header. If you ever do
want completed tasks converted, drop the predicate from BOTH files and expect that push.
*/

BEGIN;

CREATE TEMP TABLE _split ON COMMIT DROP AS
WITH lines AS (
  SELECT t.id AS task_id,
         l.ord,
         l.line,
         (l.line ~ '^[[:space:]]*([0-9]+[.)]|[-*•])[[:space:]]+[^[:space:]]') AS is_item
  FROM public.tasks t
  CROSS JOIN LATERAL regexp_split_to_table(t.description, E'\r?\n') WITH ORDINALITY AS l(line, ord)
  WHERE btrim(coalesce(t.description, '')) <> ''
    AND NOT t.completed
    AND NOT EXISTS (SELECT 1 FROM public.task_subtasks s WHERE s.task_id = t.id)
),
candidates AS (
  SELECT task_id FROM lines WHERE is_item GROUP BY task_id HAVING count(*) >= 2
),
grouped AS (
  SELECT l.*,
         sum(CASE WHEN l.is_item THEN 1 ELSE 0 END)
           OVER (PARTITION BY l.task_id ORDER BY l.ord) AS item_no
  FROM lines l
  JOIN candidates c ON c.task_id = l.task_id
),
items AS (
  SELECT task_id,
         item_no,
         btrim(string_agg(
           CASE WHEN is_item
                THEN regexp_replace(line, '^[[:space:]]*([0-9]+[.)]|[-*•])[[:space:]]+', '')
                ELSE btrim(line)
           END, E'\n' ORDER BY ord)) AS title
  FROM grouped
  WHERE item_no >= 1 AND (is_item OR btrim(line) <> '')
  GROUP BY task_id, item_no
),
preamble AS (
  SELECT task_id, btrim(string_agg(line, E'\n' ORDER BY ord)) AS description
  FROM grouped
  WHERE item_no = 0
  GROUP BY task_id
)
SELECT i.task_id,
       i.item_no,
       i.title,
       coalesce(p.description, '') AS new_description
FROM items i
LEFT JOIN preamble p ON p.task_id = i.task_id
WHERE btrim(i.title) <> '';          -- title has a NOT NULL + non-blank CHECK

-- Sanity: how many tasks and how many lines are about to be written.
SELECT count(DISTINCT task_id) AS zadataka, count(*) AS podzadataka FROM _split;

INSERT INTO public.task_subtasks (task_id, title, position)
SELECT task_id, title, (item_no - 1)::int FROM _split;

-- updated_at is bumped by hand: this table has no trigger for it (see the migration header).
UPDATE public.tasks t
SET description = s.new_description,
    updated_at  = now()
FROM (SELECT DISTINCT task_id, new_description FROM _split) s
WHERE t.id = s.task_id;

COMMIT;
