-- SEC-004: a Supervision user reads and writes contracts, and their milestones, only on projects
-- it is assigned to in project_managers (20261012100000_contracts_project_scope.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixtures, as the database owner (RLS does not apply). The sign-up trigger (handle_new_user)
-- creates the public.users row, with the role from raw_app_meta_data.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'sup@test.local', '{"provider":"email","role":"Supervision"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dir@test.local', '{"provider":"email","role":"Director"}');

insert into public.projects (id, name, location, start_date) values
  ('00000000-0000-0000-0000-0000000000b1', 'Assigned', 'Zagreb', '2026-01-01'),
  ('00000000-0000-0000-0000-0000000000b2', 'Other',    'Split',  '2026-01-01');
insert into public.subcontractors (id, name, contact)
  values ('00000000-0000-0000-0000-0000000000c1', 'Test d.o.o.', 'test');
insert into public.contracts (id, project_id, subcontractor_id, job_description) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'on assigned'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'on other');
insert into public.subcontractor_milestones (contract_id, milestone_number, milestone_name, percentage) values
  ('00000000-0000-0000-0000-0000000000d1', 1, 'milestone on assigned', 50),
  ('00000000-0000-0000-0000-0000000000d2', 1, 'milestone on other', 50);
insert into public.project_managers (user_id, project_id)
  select id, '00000000-0000-0000-0000-0000000000b1' from public.users
  where auth_user_id = '00000000-0000-0000-0000-0000000000a1';

-- As the Supervision user.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select results_eq(
  $$ select job_description from public.contracts order by 1 $$,
  array['on assigned'],
  'SEC-004: Supervision sees only contracts on projects it is assigned to'
);
select results_eq(
  $$ select milestone_name from public.subcontractor_milestones order by 1 $$,
  array['milestone on assigned'],
  'SEC-004: Supervision sees only the milestones of contracts it can see'
);
select throws_ok(
  $$ insert into public.contracts (project_id, subcontractor_id, job_description)
     values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'sneaky') $$,
  '42501', null,
  'SEC-004: Supervision cannot add a contract to a project it is not assigned to'
);
select throws_ok(
  $$ update public.contracts set project_id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '42501', null,
  'SEC-004: Supervision cannot move its contract onto a project it is not assigned to'
);
-- With no WHERE clause the SELECT policy is not consulted, so only the UPDATE policy limits which
-- rows this touches. Checked as the owner below.
select lives_ok(
  $$ update public.contracts set notes = 'touched by supervision' $$,
  'Supervision blanket update runs (and is filtered by RLS)'
);
-- RLS refuses a DELETE silently: 0 rows. Checked as the owner below.
select lives_ok(
  $$ delete from public.contracts where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'Supervision delete runs (and is filtered by RLS)'
);

-- As the Director.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select results_eq(
  $$ select count(*) from public.contracts $$,
  array[2::bigint],
  'Director sees every contract'
);

reset role;
select is((select count(*) from public.contracts where job_description = 'sneaky'), 0::bigint, 'nothing was inserted');
select is(
  (select project_id from public.contracts where id = '00000000-0000-0000-0000-0000000000d1'),
  '00000000-0000-0000-0000-0000000000b1'::uuid,
  'only Director deletes contracts: the Supervision delete removed nothing, and the contract did not move'
);
select results_eq(
  $$ select job_description from public.contracts where notes = 'touched by supervision' order by 1 $$,
  array['on assigned'],
  'SEC-004: a Supervision update reaches only contracts on its own projects'
);

-- The access function itself.
select ok(
  (select prosecdef from pg_proc where oid = 'public.app_can_access_project(uuid)'::regprocedure),
  'app_can_access_project runs as its owner'
);
select is(
  (select proconfig from pg_proc where oid = 'public.app_can_access_project(uuid)'::regprocedure),
  array['search_path=public, pg_temp'],
  'app_can_access_project has a pinned search path'
);
select ok(
  not has_function_privilege('anon', 'public.app_can_access_project(uuid)', 'execute'),
  'anon cannot call app_can_access_project'
);

-- AUTH-4: the unused two-argument overload is gone.
select hasnt_function('public', 'user_has_project_access', array['uuid', 'uuid'],
  'AUTH-4: user_has_project_access(uuid, uuid) is dropped');

select * from finish();
rollback;
