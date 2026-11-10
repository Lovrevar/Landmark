-- A deadline per checklist line (20261110100000_task_subtask_deadlines.sql): the column
-- exists; the create RPC stores a line's date; the update RPC sets it when the key is
-- present, keeps it when the key is absent (an older client bundle), clears it on null,
-- treats '' as null, dates a new line, and never disturbs a tick while doing any of that.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000060a1', 'sub-ana@test.local', '{"provider":"email","role":"Sales"}');

-- Ana's checklist, as a fixture: a ticked line with a date and an open line with one.
insert into public.tasks (id, title, description, created_by)
values ('00000000-0000-0000-0000-0000000060b1', 'Temelji', '', '00000000-0000-0000-0000-0000000060a1');
insert into public.task_assignees (task_id, assignee_id)
values ('00000000-0000-0000-0000-0000000060b1', '00000000-0000-0000-0000-0000000060a1');
insert into public.task_subtasks (id, task_id, title, position, completed, completed_at, deadline) values
  ('00000000-0000-0000-0000-0000000060c1', '00000000-0000-0000-0000-0000000060b1', 'Iskop',    0, true,  now(), '2026-11-10'),
  ('00000000-0000-0000-0000-0000000060c2', '00000000-0000-0000-0000-0000000060b1', 'Armatura', 1, false, null,  '2026-11-15');

select has_column('public', 'task_subtasks', 'deadline', 'task_subtasks has a deadline column');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000060a1","role":"authenticated"}';

-- ---------- create ----------
select lives_ok(
  $$ select public.create_task_with_assignees(
       'Krov', '', null, null,
       array['00000000-0000-0000-0000-0000000060a1']::uuid[],
       null,
       '[{"title":"Rogovi","position":0,"deadline":"2026-12-01"},
         {"title":"Letve","position":1},
         {"title":"Crijep","position":2,"deadline":""}]'::jsonb) $$,
  'create_task_with_assignees accepts a deadline per line'
);
select is(
  (select s.deadline from public.task_subtasks s join public.tasks t on t.id = s.task_id
    where t.title = 'Krov' and s.title = 'Rogovi'),
  '2026-12-01'::date,
  'a created line keeps its date'
);
select is(
  (select count(*)::int from public.task_subtasks s join public.tasks t on t.id = s.task_id
    where t.title = 'Krov' and s.title in ('Letve', 'Crijep') and s.deadline is null),
  2,
  'a created line without a date, or with an empty one, has none'
);

-- ---------- update: key present sets, key absent keeps ----------
select lives_ok(
  $$ select public.update_task_with_assignees(
       '00000000-0000-0000-0000-0000000060b1', 'Temelji', '', null, null, null,
       array['00000000-0000-0000-0000-0000000060a1']::uuid[],
       '[{"id":"00000000-0000-0000-0000-0000000060c1","title":"Iskop","position":0,"deadline":"2026-11-20"},
         {"id":"00000000-0000-0000-0000-0000000060c2","title":"Armatura","position":1}]'::jsonb) $$,
  'update_task_with_assignees accepts a deadline per line'
);
select is(
  (select deadline from public.task_subtasks where id = '00000000-0000-0000-0000-0000000060c1'),
  '2026-11-20'::date,
  'a line sent with a deadline gets it'
);
select is(
  (select deadline from public.task_subtasks where id = '00000000-0000-0000-0000-0000000060c2'),
  '2026-11-15'::date,
  'a line sent without the key keeps its date (an older client bundle)'
);
select is(
  (select completed from public.task_subtasks where id = '00000000-0000-0000-0000-0000000060c1'),
  true,
  'the tick survives a date change'
);

-- ---------- update: null clears, '' clears, a new line is dated ----------
select lives_ok(
  $$ select public.update_task_with_assignees(
       '00000000-0000-0000-0000-0000000060b1', 'Temelji', '', null, null, null,
       array['00000000-0000-0000-0000-0000000060a1']::uuid[],
       '[{"id":"00000000-0000-0000-0000-0000000060c1","title":"Iskop","position":0,"deadline":null},
         {"id":"00000000-0000-0000-0000-0000000060c2","title":"Armatura","position":1,"deadline":""},
         {"id":null,"title":"Betoniranje","position":2,"deadline":"2026-11-25"}]'::jsonb) $$,
  'update_task_with_assignees clears and adds dates'
);
select is(
  (select count(*)::int from public.task_subtasks
    where id in ('00000000-0000-0000-0000-0000000060c1', '00000000-0000-0000-0000-0000000060c2')
      and deadline is null),
  2,
  'null and the empty string both clear a date'
);
select is(
  (select deadline from public.task_subtasks
    where task_id = '00000000-0000-0000-0000-0000000060b1' and title = 'Betoniranje'),
  '2026-11-25'::date,
  'a new line arrives with its date'
);

reset role;
select is(
  (select completed from public.tasks where id = '00000000-0000-0000-0000-0000000060b1'),
  false,
  'the parent is untouched: one line is still open'
);

select * from finish();
rollback;
