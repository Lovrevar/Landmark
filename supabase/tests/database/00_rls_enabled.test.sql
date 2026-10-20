begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

-- Every table in public has RLS on. True on dev and production on 2026-10-20; this keeps it so.
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every public table has row level security enabled'
);

select * from finish();
rollback;
