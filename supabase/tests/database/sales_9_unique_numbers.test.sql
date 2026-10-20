-- SALES-9 / SALES-17: one unit number per building and one building name per project, compared
-- trimmed and case-insensitively (20261012100200_unique_unit_numbers.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.projects (id, name, location, start_date) values
  ('00000000-0000-0000-0000-0000000040b1', 'Brojevi', 'Zagreb', '2026-01-01'),
  ('00000000-0000-0000-0000-0000000040b2', 'Drugi',   'Split',  '2026-01-01');
insert into public.buildings (id, project_id, name) values
  ('00000000-0000-0000-0000-0000000040c1', '00000000-0000-0000-0000-0000000040b1', 'Zgrada A'),
  ('00000000-0000-0000-0000-0000000040c2', '00000000-0000-0000-0000-0000000040b1', 'Zgrada B');

insert into public.apartments (project_id, building_id, number, floor, size_m2, price)
  values ('00000000-0000-0000-0000-0000000040b1', '00000000-0000-0000-0000-0000000040c1', 'A-101', 1, 50, 100000);
select throws_ok(
  $$ insert into public.apartments (project_id, building_id, number, floor, size_m2, price)
     values ('00000000-0000-0000-0000-0000000040b1', '00000000-0000-0000-0000-0000000040c1', ' a-101 ', 1, 50, 100000) $$,
  '23505', null,
  'SALES-9: "A-101" and " a-101 " are one apartment number in a building'
);
select lives_ok(
  $$ insert into public.apartments (project_id, building_id, number, floor, size_m2, price)
     values ('00000000-0000-0000-0000-0000000040b1', '00000000-0000-0000-0000-0000000040c2', 'A-101', 1, 50, 100000) $$,
  'SALES-9: the same number in another building is fine'
);

-- NULLs are distinct in a unique index, so an apartment with no building is compared within
-- its project.
insert into public.apartments (project_id, number, floor, size_m2, price)
  values ('00000000-0000-0000-0000-0000000040b1', '7', 0, 50, 100000);
select throws_ok(
  $$ insert into public.apartments (project_id, number, floor, size_m2, price)
     values ('00000000-0000-0000-0000-0000000040b1', ' 7', 0, 50, 100000) $$,
  '23505', null,
  'SALES-9: two apartments without a building cannot share a number in one project'
);

insert into public.garages (building_id, number) values ('00000000-0000-0000-0000-0000000040c1', 'G-1');
select throws_ok(
  $$ insert into public.garages (building_id, number) values ('00000000-0000-0000-0000-0000000040c1', 'g-1 ') $$,
  '23505', null,
  'SALES-9: one garage number per building'
);

insert into public.repositories (building_id, number) values ('00000000-0000-0000-0000-0000000040c1', 'S-1');
select throws_ok(
  $$ insert into public.repositories (building_id, number) values ('00000000-0000-0000-0000-0000000040c1', ' s-1') $$,
  '23505', null,
  'SALES-9: one storage unit number per building'
);

select throws_ok(
  $$ insert into public.buildings (project_id, name) values ('00000000-0000-0000-0000-0000000040b1', ' zgrada a') $$,
  '23505', null,
  'SALES-17: one building name per project'
);
select lives_ok(
  $$ insert into public.buildings (project_id, name) values ('00000000-0000-0000-0000-0000000040b2', 'Zgrada A') $$,
  'SALES-17: the same building name in another project is fine'
);

select * from finish();
rollback;
