-- Task-app-only people (20261110100100_task_app_only_users.sql): an auth user carrying
-- app_metadata.task_app_only gets a profile marked external and no roster row; one without
-- the flag is provisioned exactly as before.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_column('public', 'profiles', 'external', 'profiles has an external column');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000070a1', 'vanjski@test.local',
   '{"provider":"email","providers":["email"],"task_app_only":true}', '{"name":"Vanjski Suradnik"}'),
  ('00000000-0000-0000-0000-0000000070a2', 'staff@test.local',
   '{"provider":"email","providers":["email"]}', '{}');

select is(
  (select count(*)::int from public.users where auth_user_id = '00000000-0000-0000-0000-0000000070a1'),
  0,
  'a task-app-only sign-up gets no roster row'
);
select is(
  (select name from public.profiles where id = '00000000-0000-0000-0000-0000000070a1'),
  'Vanjski Suradnik',
  'but it gets a profile, named from user_metadata'
);
select is(
  (select external from public.profiles where id = '00000000-0000-0000-0000-0000000070a1'),
  true,
  'and the profile is marked external'
);
select is(
  (select role from public.users where auth_user_id = '00000000-0000-0000-0000-0000000070a2'),
  'Sales',
  'an ordinary email sign-up is provisioned as before'
);
select is(
  (select external from public.profiles where id = '00000000-0000-0000-0000-0000000070a2'),
  false,
  'and its profile is not external'
);

-- The person works in the task app in full: the task policies compare auth.uid() and consult
-- profiles, never public.users, so an auth id with no roster row may create a task for itself.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000070a1","role":"authenticated"}';

select lives_ok(
  $$ select public.create_task_with_assignees(
       'Ograda', '', null, null,
       array['00000000-0000-0000-0000-0000000070a1']::uuid[]) $$,
  'an external person can create a task assigned to themselves'
);
select is((select public.is_admin()), false, 'and is not a task-app admin');

reset role;

select * from finish();
rollback;
