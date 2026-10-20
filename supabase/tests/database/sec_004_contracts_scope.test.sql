-- SEC-004: a Supervision user reads and writes contracts only on projects it is assigned to in
-- project_managers (20261012100000_contracts_project_scope.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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
insert into public.contracts (project_id, subcontractor_id, job_description) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'on assigned'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'on other');
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
select throws_ok(
  $$ insert into public.contracts (project_id, subcontractor_id, job_description)
     values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'sneaky') $$,
  '42501', null,
  'SEC-004: Supervision cannot add a contract to a project it is not assigned to'
);

-- As the Director.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select results_eq(
  $$ select count(*) from public.contracts $$,
  array[2::bigint],
  'Director sees every contract'
);

reset role;
select is((select count(*) from public.contracts where job_description = 'sneaky'), 0::bigint, 'nothing was written');

select * from finish();
rollback;
