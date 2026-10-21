-- SEC-A12: a file in the documents and contract-documents buckets can be deleted only by its
-- uploader, a Director or Accounting (20261009100000_storage_document_delete_policies.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Fixtures, as the database owner.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000020a1', 'uploader@test.local', '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000020a2', 'other@test.local',    '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000020a3', 'dir@test.local',      '{"provider":"email","role":"Director"}'),
  ('00000000-0000-0000-0000-0000000020a4', 'acc@test.local',      '{"provider":"email","role":"Accounting"}');

insert into storage.objects (bucket_id, name, owner, owner_id)
select bucket, name, '00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000020a1'
from (values ('documents', 'sec-a12/own.pdf'), ('documents', 'sec-a12/for-director.pdf'),
             ('contract-documents', 'sec-a12/own.pdf'), ('contract-documents', 'sec-a12/for-accounting.pdf')) f(bucket, name);

-- Storage refuses any direct DELETE on storage.objects unless this is set (storage.protect_delete),
-- so the policies below are what decides.
set local storage.allow_delete_query = 'true';

-- Another Sales user: refused in both buckets. RLS refuses a DELETE silently, so count afterwards.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000020a2","role":"authenticated"}';
select lives_ok(
  $$ delete from storage.objects where name like 'sec-a12/%' $$,
  'a delete by another user runs (and is filtered by RLS)'
);
reset role;
select results_eq(
  $$ select bucket_id, count(*) from storage.objects where name like 'sec-a12/%' group by 1 order by 1 $$,
  $$ values ('contract-documents'::text, 2::bigint), ('documents'::text, 2::bigint) $$,
  'SEC-A12: a Sales user cannot delete another user''s files in either bucket'
);

-- The uploader: their own file, in each bucket.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}';
select lives_ok(
  $$ delete from storage.objects where name = 'sec-a12/own.pdf' $$,
  'the uploader deletes their own files'
);
reset role;
select is(
  (select count(*) from storage.objects where name = 'sec-a12/own.pdf'),
  0::bigint,
  'SEC-A12: the uploader can delete their own file in both buckets'
);

-- Director and Accounting: any file.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000020a3","role":"authenticated"}';
select lives_ok(
  $$ delete from storage.objects where name = 'sec-a12/for-director.pdf' $$,
  'Director deletes a file someone else uploaded'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000020a4","role":"authenticated"}';
select lives_ok(
  $$ delete from storage.objects where name = 'sec-a12/for-accounting.pdf' $$,
  'Accounting deletes a file someone else uploaded'
);
reset role;
select is(
  (select count(*) from storage.objects where name like 'sec-a12/%'),
  0::bigint,
  'SEC-A12: Director and Accounting can delete any document file'
);

-- No way to overwrite a document file in place.
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'ALL')
       and coalesce(qual, '') || coalesce(with_check, '') ~ '''(contract-)?documents''' $$,
  'no UPDATE policy on the document buckets'
);

select * from finish();
rollback;
