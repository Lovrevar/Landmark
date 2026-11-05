-- GEN-22: a TIC with no phased line no longer puts the whole budget on phase 1. Across several
-- phases every phase budget is NULL; a single phase holds the whole plan
-- (20261015100000_unphased_tic_phase_budgets.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- A project with three phases, then an unphased TIC of 1000: 600 + (300 + 100).
insert into public.projects (id, name, location, start_date)
  values ('00000000-0000-0000-0000-0000000030b1', 'TIC', 'Zagreb', '2026-01-01');
insert into public.project_phases (id, project_id, phase_number, phase_name) values
  ('00000000-0000-0000-0000-0000000030c1', '00000000-0000-0000-0000-0000000030b1', 1, 'Faza 1'),
  ('00000000-0000-0000-0000-0000000030c2', '00000000-0000-0000-0000-0000000030b1', 2, 'Faza 2'),
  ('00000000-0000-0000-0000-0000000030c3', '00000000-0000-0000-0000-0000000030b1', 3, 'Faza 3');
insert into public.tic_cost_structures (project_id, line_items) values (
  '00000000-0000-0000-0000-0000000030b1',
  '[{"classification_id": 1, "vlastita": 600, "kreditna": 0},
    {"classification_id": 3, "vlastita": 300, "kreditna": 100}]'
);

select is(
  (select budget from public.projects where id = '00000000-0000-0000-0000-0000000030b1'),
  1000::numeric,
  'the project budget is the TIC total'
);
select results_eq(
  $$ select budget_allocated from public.project_phases
     where project_id = '00000000-0000-0000-0000-0000000030b1' order by phase_number $$,
  $$ values (null::numeric), (null::numeric), (null::numeric) $$,
  'GEN-22: an unphased TIC on three phases leaves every phase budget unset, not all on phase 1'
);
select is(
  (select count(*) from public.phase_classification_budgets
   where phase_id in (select id from public.project_phases where project_id = '00000000-0000-0000-0000-0000000030b1')),
  0::bigint,
  'GEN-22: and writes no per-phase classification budgets'
);

-- Delete phases 1 and 2: the survivor, phase 3, gets the whole plan.
delete from public.project_phases where id in ('00000000-0000-0000-0000-0000000030c1', '00000000-0000-0000-0000-0000000030c2');
select is(
  (select budget_allocated from public.project_phases where id = '00000000-0000-0000-0000-0000000030c3'),
  1000::numeric,
  'GEN-22: the only phase left holds the whole plan, whatever its number'
);
select results_eq(
  $$ select classification_id, budget_allocated from public.phase_classification_budgets
     where phase_id = '00000000-0000-0000-0000-0000000030c3' order by 1 $$,
  $$ values (1, 600::numeric), (3, 400::numeric) $$,
  'GEN-22: and the classification split'
);

-- Add a phase back: split again.
insert into public.project_phases (project_id, phase_number, phase_name)
  values ('00000000-0000-0000-0000-0000000030b1', 4, 'Faza 4');
select results_eq(
  $$ select budget_allocated from public.project_phases
     where project_id = '00000000-0000-0000-0000-0000000030b1' order by phase_number $$,
  $$ values (null::numeric), (null::numeric) $$,
  'GEN-22: adding a phase re-applies the split'
);
select is(
  (select count(*) from public.phase_classification_budgets
   where phase_id in (select id from public.project_phases where project_id = '00000000-0000-0000-0000-0000000030b1')),
  0::bigint,
  'GEN-22: and removes the single phase''s classification budgets'
);

-- The functions: run as their owner with a pinned search path, never callable by app users.
select is(
  (select string_agg(p.proname || ' ' || p.prosecdef || ' ' || array_to_string(p.proconfig, ';'), ' | ' order by p.proname)
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('apply_unphased_tic_budget', 'sync_project_from_tic', 'reapply_unphased_tic_on_phase_change')),
  'apply_unphased_tic_budget true search_path=public, pg_temp'
  || ' | reapply_unphased_tic_on_phase_change true search_path=public, pg_temp'
  || ' | sync_project_from_tic true search_path=public, pg_temp',
  'the TIC functions run as their owner, with a pinned search path'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_unphased_tic_budget(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_project_from_tic(uuid)', 'execute'),
  'signed-in users cannot call the TIC sync functions directly'
);
-- Listening to budget_allocated would re-enter the trigger from its own UPDATE.
select is(
  (select pg_get_triggerdef(oid) ~ 'AFTER INSERT OR DELETE OR UPDATE OF project_id ON public.project_phases'
   from pg_trigger where tgname = 'trg_project_phases_unphased_tic'),
  true,
  'the phase trigger fires on insert, delete and a move only'
);

select * from finish();
rollback;
