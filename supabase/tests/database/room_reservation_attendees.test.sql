-- Meeting attendees (20261027100100_room_reservation_attendees.sql): everyone reads; the
-- reservation's creator or an admin adds and removes; an attendee may leave; a row cannot be
-- updated; attendees cascade with the reservation; the table is published for realtime.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000050a1', 'att-ana@test.local',   '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000050a2', 'att-boris@test.local', '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000050a3', 'att-cvita@test.local', '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000050a4', 'att-admin@test.local', '{"provider":"email","role":"Sales"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000050a4';

-- Ana's meeting, as a fixture.
insert into public.room_reservations (id, room_id, title, start_at, end_at, created_by)
select '00000000-0000-0000-0000-0000000050b1', id, 'Koordinacija',
       '2030-02-01 09:00+01', '2030-02-01 10:00+01', '00000000-0000-0000-0000-0000000050a1'
  from public.meeting_rooms where name = 'Velika konferencija';

-- ---------- the creator invites ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000050a1","role":"authenticated"}';
select lives_ok(
  $$ insert into public.room_reservation_attendees (reservation_id, user_id) values
       ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000050a2'),
       ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000050a3') $$,
  'the creator adds two attendees'
);
select throws_ok(
  $$ insert into public.room_reservation_attendees (reservation_id, user_id) values
       ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000050a3') $$,
  '23505',
  null,
  'the same person cannot be added twice'
);

-- ---------- an attendee ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000050a2","role":"authenticated"}';
select is(
  (select count(*)::int from public.room_reservation_attendees where reservation_id = '00000000-0000-0000-0000-0000000050b1'),
  2,
  'an attendee sees the whole list'
);
select throws_ok(
  $$ insert into public.room_reservation_attendees (reservation_id, user_id) values
       ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000050a4') $$,
  '42501',
  null,
  'an attendee cannot invite anybody else'
);
delete from public.room_reservation_attendees
 where reservation_id = '00000000-0000-0000-0000-0000000050b1' and user_id = '00000000-0000-0000-0000-0000000050a3';
select is(
  (select count(*)::int from public.room_reservation_attendees where user_id = '00000000-0000-0000-0000-0000000050a3'),
  1,
  'an attendee cannot remove somebody else (the row stays)'
);
delete from public.room_reservation_attendees
 where reservation_id = '00000000-0000-0000-0000-0000000050b1' and user_id = '00000000-0000-0000-0000-0000000050a2';
select is(
  (select count(*)::int from public.room_reservation_attendees where user_id = '00000000-0000-0000-0000-0000000050a2'),
  0,
  'an attendee removes themselves'
);
select throws_ok(
  $$ update public.room_reservation_attendees set created_at = now() $$,
  '42501',
  null,
  'a row cannot be updated (no grant, no policy)'
);

-- ---------- an admin ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000050a4","role":"authenticated"}';
select lives_ok(
  $$ insert into public.room_reservation_attendees (reservation_id, user_id) values
       ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000050a2') $$,
  'an admin adds an attendee to somebody else''s meeting'
);
delete from public.room_reservation_attendees
 where reservation_id = '00000000-0000-0000-0000-0000000050b1' and user_id = '00000000-0000-0000-0000-0000000050a3';
select is(
  (select count(*)::int from public.room_reservation_attendees where user_id = '00000000-0000-0000-0000-0000000050a3'),
  0,
  'an admin removes an attendee from somebody else''s meeting'
);

set local role anon;
select throws_ok(
  $$ select 1 from public.room_reservation_attendees $$,
  '42501',
  null,
  'anon cannot read attendees'
);
reset role;

-- ---------- cascade and realtime ----------
delete from public.room_reservations where id = '00000000-0000-0000-0000-0000000050b1';
select is(
  (select count(*)::int from public.room_reservation_attendees where reservation_id = '00000000-0000-0000-0000-0000000050b1'),
  0,
  'attendees go with the reservation'
);
select ok(
  exists (select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_reservation_attendees'),
  'room_reservation_attendees is in the supabase_realtime publication'
);

select * from finish();
rollback;
