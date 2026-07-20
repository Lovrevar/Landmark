/*
# Add title column to tasks

## Why
Tasks previously had only a `description` field, which the UI used as the
primary label on task lists. Descriptions can be long, so the list became
unreadable. We now split the task into a short `title` (shown on the list)
and a longer `description` (shown when the task is opened).

## Changes
1. Add `title` column to `public.tasks`:
   - `title text NOT NULL` — short headline shown on the task list.
   - Added first so existing rows can be backfilled before the NOT NULL
     constraint is enforced.
2. Backfill: copy the existing `description` value into `title` for all
   current rows (where title IS NULL). Existing tasks keep their text as
   the title; the description stays the same.
3. Set `title` to NOT NULL so every future task must have a headline.

## Security
No RLS / policy changes — the `title` column is covered by the existing
task policies (select/insert/update/delete already apply to the whole row).
*/

-- 1. Add the column as nullable first so backfill can run.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS title text;

-- 2. Backfill existing rows: use the description as the title.
UPDATE public.tasks
SET title = description
WHERE title IS NULL;

-- 3. Enforce NOT NULL now that every row has a value.
ALTER TABLE public.tasks ALTER COLUMN title SET NOT NULL;
