/*
# Meeting attendees

Follows 20261027100000_meeting_rooms.sql. A reservation was a room and a time; the users
want people on it too, so the task app can say who a meeting is for and buzz them. This is
the junction, modelled on task_assignees, and nothing else: no RSVP (decided 2026-10-27, a
`response` column is a cheap later addition since nothing here narrows column grants), and
no Cognilion surface (COLLAB-14 still stands).

## Shape
- Composite primary key (reservation_id, user_id). As with task_assignees that is what makes
  PostgREST see an m2m junction and allow the flat embed
  `attendees:profiles!room_reservation_attendees(id, name)` the task app reads with.
- `user_id` is an auth id → profiles, like every user column in the task tables.
- The creator is an implicit attendee and gets no row. "Moji sastanci" on the phone is
  creator OR attendee; storing the creator as well would double-count them on every edit.

## Who may do what
- Everybody reads (the board is public, so is who is in the room).
- The reservation's creator or a task-app admin adds and removes attendees. Edits reconcile
  as a set difference, so an unchanged row keeps its created_at.
- An attendee may remove themselves — "ne dolazim" without a response column.
- There is no UPDATE: a row has nothing to update. The grant says the same.

## Push
The task app notifies attendees through the send-push edge function in this repo, which
gained `meeting_invited` and `meeting_cancelled` (user events, same cross-gate as the task
events). The client sends only `reservationId`; the function re-reads the reservation and its
attendees with the service role, so the fan-out cannot be widened from outside, and only the
creator or an admin may trigger either. Because the function re-reads the row, a cancel is
sent BEFORE the row is deleted — the client awaits that call, then deletes. See
docs/SHARED_SCHEMA.md §15.

Apply to LandmarkDev first, then production together with 20261027100000, and deploy
send-push before the task app build that invites people ships.
*/

-- ---------- 1. table ----------
CREATE TABLE IF NOT EXISTS public.room_reservation_attendees (
  reservation_id uuid NOT NULL REFERENCES public.room_reservations(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reservation_id, user_id)
);

-- "Moji sastanci" is a lookup by user; the PK already serves the per-reservation side.
CREATE INDEX IF NOT EXISTS idx_room_reservation_attendees_user
  ON public.room_reservation_attendees (user_id);

COMMENT ON TABLE public.room_reservation_attendees IS
  'Who a meeting is for, one row per invitee. The creator is implicit and has no row. Shared with the standalone task app (SHARED_SCHEMA.md §15). Composite PK is load-bearing: it is what lets PostgREST embed attendees:profiles!room_reservation_attendees.';

-- ---------- 2. RLS ----------
ALTER TABLE public.room_reservation_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees: anyone signed in can view" ON public.room_reservation_attendees;
CREATE POLICY "Attendees: anyone signed in can view" ON public.room_reservation_attendees
  FOR SELECT TO authenticated
  USING (true);

-- The parent's SELECT policy is USING (true), so consulting it from here cannot recurse into
-- anything the caller is not allowed to see; no SECURITY DEFINER helper is needed.
DROP POLICY IF EXISTS "Attendees: reservation creator or admin can insert" ON public.room_reservation_attendees;
CREATE POLICY "Attendees: reservation creator or admin can insert" ON public.room_reservation_attendees
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT r.created_by FROM public.room_reservations r WHERE r.id = reservation_id) = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Attendees: creator, admin or self can delete" ON public.room_reservation_attendees;
CREATE POLICY "Attendees: creator, admin or self can delete" ON public.room_reservation_attendees
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT r.created_by FROM public.room_reservations r WHERE r.id = reservation_id) = auth.uid()
    OR public.is_admin()
  );

-- ---------- 3. realtime ----------
-- Being added to a meeting should show up on the phone without a refetch; see the matching
-- block in 20261027100000 for why this is recorded here at all.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication missing; realtime not configured on this database';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                    AND tablename = 'room_reservation_attendees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_reservation_attendees;
  END IF;
END $$;

-- ---------- 4. grants, saying the same as the policies ----------
REVOKE ALL ON public.room_reservation_attendees FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.room_reservation_attendees TO authenticated;
GRANT ALL ON public.room_reservation_attendees TO service_role;
