-- COLLAB-18 (20261110100200_task_app_only_admin_api.sql): the Auth admin API inserts the user
-- first and merges app_metadata in a later UPDATE, so the flag has to be honoured on the UPDATE.
-- This file does exactly what GoTrue does: insert without the flag, then set it. The roster row
-- the insert provisioned must go, the profile must come out external and named from
-- user_metadata; a long-standing roster row must survive the same flag; other app_metadata
-- changes must do nothing; and the person must be able to work in the task app.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_trigger('auth', 'users', 'on_auth_user_task_app_only',
  'COLLAB-18: the undo trigger exists on auth.users');

-- ---------- the API shape: insert without the flag, then set it ----------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000070b1', 'vanjski-api@test.local',
   '{"provider":"email","providers":["email"]}', '{"name":"Vanjski Suradnik"}');

select is(
  (select count(*)::int from public.users where auth_user_id = '00000000-0000-0000-0000-0000000070b1'),
  1,
  'COLLAB-18: the insert alone provisions a roster row (what the API does first)'
);

select lives_ok(
  $$ update auth.users
        set raw_app_meta_data = raw_app_meta_data || '{"task_app_only": true}'::jsonb
      where id = '00000000-0000-0000-0000-0000000070b1' $$,
  'COLLAB-18: setting the flag afterwards is accepted'
);
select is(
  (select count(*)::int from public.users where auth_user_id = '00000000-0000-0000-0000-0000000070b1'),
  0,
  'COLLAB-18: the roster row the insert provisioned is gone'
);
select is(
  (select external from public.profiles where id = '00000000-0000-0000-0000-0000000070b1'),
  true,
  'COLLAB-18: the profile is marked external'
);
select is(
  (select name from public.profiles where id = '00000000-0000-0000-0000-0000000070b1'),
  'Vanjski Suradnik',
  'COLLAB-18: the profile is named from user_metadata, not the username'
);
select is(
  (select role from public.profiles where id = '00000000-0000-0000-0000-0000000070b1'),
  'user',
  'COLLAB-18: an external person is never a task-app admin'
);

-- ---------- a real Landmark user keeps their roster row whatever the flag says ----------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000070b2', 'staff-old@test.local',
   '{"provider":"email","providers":["email"]}', '{}');
update public.users set created_at = now() - interval '1 day'
 where auth_user_id = '00000000-0000-0000-0000-0000000070b2';

select lives_ok(
  $$ update auth.users
        set raw_app_meta_data = raw_app_meta_data || '{"task_app_only": true}'::jsonb
      where id = '00000000-0000-0000-0000-0000000070b2' $$,
  'COLLAB-18: the flag on a long-standing user is accepted (and warned about)'
);
select is(
  (select role from public.users where auth_user_id = '00000000-0000-0000-0000-0000000070b2'),
  'Sales',
  'COLLAB-18: their roster row survives'
);
select is(
  (select external from public.profiles where id = '00000000-0000-0000-0000-0000000070b2'),
  false,
  'COLLAB-18: and their profile is not marked external'
);

-- ---------- other app_metadata changes leave the roster alone ----------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000070b3', 'staff-linked@test.local',
   '{"provider":"email","providers":["email"]}', '{}');

select lives_ok(
  $$ update auth.users
        set raw_app_meta_data = raw_app_meta_data || '{"providers": ["email", "azure"]}'::jsonb
      where id = '00000000-0000-0000-0000-0000000070b3' $$,
  'COLLAB-18: an identity-linking rewrite of app_metadata is accepted'
);
select is(
  (select count(*)::int from public.users where auth_user_id = '00000000-0000-0000-0000-0000000070b3'),
  1,
  'COLLAB-18: and does not touch the roster row'
);

-- ---------- the external person works in the task app ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000070b1","role":"authenticated"}';

select lives_ok(
  $$ select public.create_task_with_assignees(
       'Ograda', '', null, null,
       array['00000000-0000-0000-0000-0000000070b1']::uuid[]) $$,
  'COLLAB-18: an external person created through the API can create a task for themselves'
);
select is((select public.is_admin()), false, 'COLLAB-18: and is not a task-app admin');

reset role;

select * from finish();
rollback;
