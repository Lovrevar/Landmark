/*
# Repoint tasks.assignee_id FK to profiles

## Why
The frontend nests `assignee:profiles!tasks_assignee_id_fkey` in its task select
to fetch the assignee's display name in one query. PostgREST resolves nested
relations by following a foreign key whose target table matches the nested
alias. The original FK pointed tasks.assignee_id -> auth.users(id), so the join
to `profiles` could not resolve (auth.users is a different table than profiles).

## Change
- Drop the existing constraint `tasks_assignee_id_fkey` (tasks.assignee_id -> auth.users).
- Recreate it as tasks.assignee_id -> profiles(id) ON DELETE CASCADE.
  Since profiles.id is itself a FK to auth.users(id) ON DELETE CASCADE, deleting
  a user still cascades: auth.users row deleted -> profiles row deleted -> tasks
  row deleted. No data loss; the cascade chain is preserved.
- The RLS policy `auth.uid() = assignee_id` still works because profiles.id holds
  the same UUID value as the matching auth.users.id.

## Safety
- No columns are dropped, renamed, or retyped. Only the FK constraint is swapped.
- No data rows are affected. Existing assignee_id values already exist in
  profiles (seeded + created via the manage-users edge function), so the new FK
  is satisfied.
*/

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
