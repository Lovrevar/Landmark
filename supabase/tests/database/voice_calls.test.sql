-- Voice calls (20261026100000_voice_calls.sql): voice_calls holds a live JWT, so no signed-in
-- user may read or write it; ai_sessions.channel defaults to 'chat' and accepts only chat/voice.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixtures, as the database owner.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000030a1', 'voice-dir@test.local', '{"provider":"email","role":"Director"}');

insert into public.ai_sessions (id, user_id)
select '00000000-0000-0000-0000-0000000030b1', u.id
from public.users u where u.auth_user_id = '00000000-0000-0000-0000-0000000030a1';

insert into public.voice_calls (session_id, user_id, call_token_hash, platform_call_id, access_token, expires_at)
select '00000000-0000-0000-0000-0000000030b1', u.id, 'hash-1', 'room-1', 'jwt-1', now() + interval '15 minutes'
from public.users u where u.auth_user_id = '00000000-0000-0000-0000-0000000030a1';

select is(
  (select channel from public.ai_sessions where id = '00000000-0000-0000-0000-0000000030b1'),
  'chat',
  'a session created without a channel is a chat session'
);
select throws_ok(
  $$ update public.ai_sessions set channel = 'phone' where id = '00000000-0000-0000-0000-0000000030b1' $$,
  '23514',
  null,
  'channel accepts only chat and voice'
);

-- Even a Director, signed in, cannot see or touch voice_calls.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}';
select throws_ok(
  $$ select access_token from public.voice_calls $$,
  '42501',
  null,
  'a signed-in user cannot read voice_calls (the stored JWT)'
);
select throws_ok(
  $$ insert into public.voice_calls (session_id, user_id, call_token_hash, access_token, expires_at)
     values ('00000000-0000-0000-0000-0000000030b1', gen_random_uuid(), 'hash-2', 'jwt-2', now()) $$,
  '42501',
  null,
  'a signed-in user cannot insert into voice_calls'
);
select throws_ok(
  $$ delete from public.voice_calls $$,
  '42501',
  null,
  'a signed-in user cannot delete from voice_calls'
);
set local role anon;
select throws_ok(
  $$ select 1 from public.voice_calls $$,
  '42501',
  null,
  'anon cannot read voice_calls'
);
reset role;

select is(
  (select count(*)::int from public.voice_calls where platform_call_id = 'room-1'),
  1,
  'the row is still there after the refused delete'
);

select * from finish();
rollback;
