-- Meeting rooms (20261027100000_meeting_rooms.sql): two rooms seeded; every signed-in user sees
-- every reservation; anyone books as themselves; the database refuses an overlap on a room;
-- only the creator or a task-app admin edits or deletes; only an admin manages rooms.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Fixtures, as the database owner. The sign-up chain (auth.users → public.users → profiles)
-- gives each a profile with role 'user'; the third is promoted to the task-app admin.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000040a1', 'rooms-ana@test.local',   '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000040a2', 'rooms-boris@test.local', '{"provider":"email","role":"Sales"}'),
  ('00000000-0000-0000-0000-0000000040a3', 'rooms-admin@test.local', '{"provider":"email","role":"Sales"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000040a3';

select is(
  (select count(*)::int from public.meeting_rooms where active),
  2,
  'the two conference rooms are seeded'
);
-- The phones keep the board live over realtime, which delivers only for published tables.
select ok(
  exists (select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_reservations'),
  'room_reservations is in the supabase_realtime publication'
);
select ok(
  exists (select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_rooms'),
  'meeting_rooms is in the supabase_realtime publication'
);

-- ---------- Ana books ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040a1","role":"authenticated"}';

select lives_ok(
  $$ insert into public.room_reservations (id, room_id, title, start_at, end_at, created_by)
     select '00000000-0000-0000-0000-0000000040b1', id, 'Sastanak s bankom',
            '2030-01-15 09:00+01', '2030-01-15 10:00+01', '00000000-0000-0000-0000-0000000040a1'
       from public.meeting_rooms where name = 'Mala konferencija' $$,
  'a signed-in user books a room as themselves'
);
select throws_ok(
  $$ insert into public.room_reservations (room_id, start_at, end_at, created_by)
     select id, '2030-01-16 09:00+01', '2030-01-16 10:00+01', '00000000-0000-0000-0000-0000000040a2'
       from public.meeting_rooms where name = 'Mala konferencija' $$,
  '42501',
  null,
  'a booking in somebody else''s name is refused'
);
select throws_ok(
  $$ insert into public.room_reservations (room_id, start_at, end_at, created_by)
     select id, '2030-01-16 10:00+01', '2030-01-16 09:00+01', '00000000-0000-0000-0000-0000000040a1'
       from public.meeting_rooms where name = 'Mala konferencija' $$,
  '23514',
  null,
  'a booking that ends before it starts is refused'
);
select throws_ok(
  $$ insert into public.room_reservations (room_id, start_at, end_at, created_by)
     select id, '2030-01-16 09:00+01', '2030-01-17 10:00+01', '00000000-0000-0000-0000-0000000040a1'
       from public.meeting_rooms where name = 'Mala konferencija' $$,
  '23514',
  null,
  'a booking longer than 24 hours is refused'
);

-- ---------- Boris sees it and cannot take the slot ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040a2","role":"authenticated"}';

select is(
  (select count(*)::int from public.room_reservations),
  1,
  'another user sees the booking'
);
select is(
  (select title from public.room_reservations where id = '00000000-0000-0000-0000-0000000040b1'),
  'Sastanak s bankom',
  'and its title'
);
select throws_ok(
  $$ insert into public.room_reservations (room_id, start_at, end_at, created_by)
     select id, '2030-01-15 09:30+01', '2030-01-15 10:30+01', '00000000-0000-0000-0000-0000000040a2'
       from public.meeting_rooms where name = 'Mala konferencija' $$,
  '23P01',
  null,
  'an overlapping booking of the same room is refused by the database'
);
select throws_ok(
  $$ insert into public.room_reservations (room_id, start_at, end_at, created_by)
     select id, '2030-01-15 08:00+01', '2030-01-15 11:00+01', '00000000-0000-0000-0000-0000000040a2'
       from public.meeting_rooms where name = 'Mala konferencija' $$,
  '23P01',
  null,
  'a booking that surrounds an existing one is refused too'
);
select lives_ok(
  $$ insert into public.room_reservations (id, room_id, start_at, end_at, created_by)
     select '00000000-0000-0000-0000-0000000040b2', id, '2030-01-15 10:00+01', '2030-01-15 11:00+01', '00000000-0000-0000-0000-0000000040a2'
       from public.meeting_rooms where name = 'Mala konferencija' $$,
  'a booking that starts when the previous one ends is fine'
);
select lives_ok(
  $$ insert into public.room_reservations (room_id, start_at, end_at, created_by)
     select id, '2030-01-15 09:00+01', '2030-01-15 10:00+01', '00000000-0000-0000-0000-0000000040a2'
       from public.meeting_rooms where name = 'Velika konferencija' $$,
  'the other room is free at the same time'
);

-- Blanket update and delete, no WHERE: RLS lets only Boris's own row through. (RLS refuses
-- an UPDATE or DELETE silently, so the assertion is on what is left.)
update public.room_reservations set title = 'Promijenjeno';
select is(
  (select count(*)::int from public.room_reservations where title = 'Promijenjeno'),
  2,
  'a blanket update changes only the user''s own bookings (two of the three)'
);
delete from public.room_reservations where id = '00000000-0000-0000-0000-0000000040b1';
select is(
  (select count(*)::int from public.room_reservations where id = '00000000-0000-0000-0000-0000000040b1'),
  1,
  'deleting somebody else''s booking touches no row'
);
reset role;
select is(
  (select title from public.room_reservations where id = '00000000-0000-0000-0000-0000000040b1'),
  'Sastanak s bankom',
  'Ana''s booking is untouched after Boris''s update and delete'
);

-- ---------- updated_at is kept by the trigger ----------
update public.room_reservations set updated_at = '2000-01-01' where id = '00000000-0000-0000-0000-0000000040b1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040a1","role":"authenticated"}';
update public.room_reservations set end_at = '2030-01-15 09:45+01' where id = '00000000-0000-0000-0000-0000000040b1';
select is(
  (select updated_at from public.room_reservations where id = '00000000-0000-0000-0000-0000000040b1'),
  now(),
  'an edit stamps updated_at without the client writing it'
);

-- ---------- rooms are the admin''s ----------
select throws_ok(
  $$ insert into public.meeting_rooms (name) values ('Terasa') $$,
  '42501',
  null,
  'a regular user cannot add a room'
);
update public.meeting_rooms set active = false;
select is(
  (select count(*)::int from public.meeting_rooms where active),
  2,
  'a regular user cannot deactivate a room'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000040a3","role":"authenticated"}';
select lives_ok(
  $$ insert into public.meeting_rooms (name, sort_order) values ('Terasa', 3) $$,
  'an admin adds a room'
);
delete from public.room_reservations where id = '00000000-0000-0000-0000-0000000040b2';
select is(
  (select count(*)::int from public.room_reservations where id = '00000000-0000-0000-0000-0000000040b2'),
  0,
  'an admin deletes somebody else''s booking'
);

set local role anon;
select throws_ok(
  $$ select 1 from public.meeting_rooms $$,
  '42501',
  null,
  'anon cannot read the rooms'
);
reset role;

select * from finish();
rollback;
