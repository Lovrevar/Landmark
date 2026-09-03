/*
# Backfill, step 1 of 2: the DRY RUN. This file writes nothing.

Existing tasks whose description is already a numbered or bulleted list are the reason
subtasks exist. This shows exactly which tasks would be converted and what they would turn
into. Read the output, then run docs/subtasks-backfill.sql to apply it.

## Run this AFTER the schema migration, not before
It reads public.task_subtasks (to skip tasks that already have lines), so it cannot run until
supabase/migrations/20260902110000_task_subtasks.sql has been applied. Order is:
migration -> this preview -> read the output -> docs/subtasks-backfill.sql.

## Not a migration
This is a one-shot data operation you want to eyeball before applying, which is why it lives
in docs/ rather than supabase/migrations/. Run it by hand against the target database.

The split rules, deliberately conservative:
  - A task is a candidate only if it is NOT completed, has no subtasks yet, AND its
    description has at least TWO lines that look like list items. Prose containing a stray
    "1." is left alone.
  - An item line is  ^whitespace, then  1.  1)  -  *  or  •  then whitespace, then content.
  - The marker is stripped; the rest of the line becomes the subtask title, in file order.
  - Text ABOVE the first item stays in the description.
  - A non-item line BELOW the first item is treated as a wrapped continuation of the item
    above it and appended to that title, never dropped. Blank lines are discarded.

## Why completed tasks are skipped
Inserted subtasks start unticked, so the trigger would flip a converted task back to open.
In this database a reopened task with a deadline in the last 30 days is picked up by
dispatch_due_reminders() the next morning and pushed to its assignees — a backfill should not
buzz the whole crew about work that was finished months ago. `AND NOT t.completed` in the
`lines` CTE below is what prevents it. (The mobile app's reference version omits this; it has
no reminder dispatcher.)

Nothing is lost: every character of the original list ends up in a subtask title, so the
description is reconstructible from the rows if a split comes out wrong.

The CTE below is duplicated verbatim in docs/subtasks-backfill.sql. If you change one, change
both, and re-run this preview before applying.
*/

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
-- A running count of items seen so far turns "which item does this line belong to" into one
-- window function: item_no = 0 is the preamble, 1..n are the items and their continuations.
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
SELECT t.id,
       t.title                                   AS zadatak,
       t.description                             AS opis_prije,
       coalesce(p.description, '')               AS opis_poslije,
       count(i.*)                                AS broj_podzadataka,
       string_agg(format('%s. %s', i.item_no, i.title), E'\n' ORDER BY i.item_no) AS podzadaci
FROM items i
JOIN public.tasks t ON t.id = i.task_id
LEFT JOIN preamble p ON p.task_id = i.task_id
GROUP BY t.id, t.title, t.description, p.description
ORDER BY t.title;
