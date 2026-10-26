/*
# Meeting rooms and reservations

The company has two conference rooms, "Mala konferencija" and "Velika konferencija", and no
way to see who has one when. The request came through the standalone task app (the PWA the
site teams carry): a room board where anybody can book a slot and everybody can see that it
is taken. These two tables are that board. They are **shared with the task app** the same way
the `task*` tables are — see docs/SHARED_SCHEMA.md — and Cognilion has no UI for them yet.

## Why not calendar_events
Three reasons, each one enough on its own:

1. `calendar_events.created_by` and `calendar_event_participants.user_id` reference
   `public.users`. The task app only knows `auth.users` ids and `public.profiles`, and giving
   it a second identity model is how the task tables got their worst bugs. These tables key
   `created_by` on `profiles(id)` exactly like `tasks.created_by`.
2. "Events: creator or participant can view" is the opposite of what a room board needs. A
   booking has to be visible to everyone, or nobody can tell the room is taken.
3. Cognilion expands recurrence client-side with the `rrule` library and takes no overlap
   check in the database. A room needs the check in the database (below) and, for now, no
   recurrence at all — decided 2026-10-27, see "No recurrence".

## The one thing the database does that a client cannot
`room_reservations_no_overlap` is an exclusion constraint over (room_id, [start_at, end_at)).
Two phones booking the same slot in the same second get one success and one `23P01`; there is
no window for a client-side "is it free?" check to lose. The range is half-open, so a booking
that ends at 10:00 and one that starts at 10:00 do not collide. It needs `btree_gist` for the
`room_id WITH =` arm — the extension is enabled here; it is on Supabase's supported list and
on the local stack.

## No recurrence
A weekly standing meeting is the obvious next ask. The exclusion constraint protects rows,
not rules, so recurrence here means materialising the next N weeks as individual rows — the
guarantee survives, the client just inserts several. That is a client feature when it comes;
nothing in this schema has to change for it.

## Who may do what
- Every signed-in user reads every room and every reservation. Titles are therefore public;
  the client makes the title optional and shows "Sastanak" for an empty one, so nobody has to
  disclose what a meeting is about.
- Anyone books. A reservation's `created_by` must be the caller.
- The creator or a task-app admin (`profiles.role = 'admin'`, via `is_admin()`) edits or
  deletes a reservation. This is the task tables' notion of admin, not Cognilion's Director
  role, because the task app is the client and that is the role it manages.
- Only an admin changes the rooms themselves. Adding a third room or renaming one is a row,
  never a deploy. A room is never deleted while it has reservations (`ON DELETE RESTRICT`);
  set `active = false` instead and the client stops offering it.

## Other choices
- `created_by` is nullable with `ON DELETE SET NULL`, like `tasks.created_by`: deleting a user
  keeps the room history. A null creator is nobody's to edit except an admin.
- `updated_at` is kept by a trigger. The task tables leave it to every writer and
  SHARED_SCHEMA.md spends a paragraph warning about it; a new table gets to do it right.
- A booking is capped at 24 hours. Without it a mistyped date blocks a room for a month.
- Times are `timestamptz`. The client shows them in the device's zone, which is Europe/Zagreb.

Apply to LandmarkDev first, then production; then `npm run db:types` here and in the task
app's repo. SHARED_SCHEMA.md §15 describes the contract for the task app.
*/

-- ---------- 0. extension ----------
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ---------- 1. rooms ----------
CREATE TABLE IF NOT EXISTS public.meeting_rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  sort_order int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_rooms_name_key UNIQUE (name)
);

COMMENT ON TABLE public.meeting_rooms IS
  'The bookable conference rooms. Shared with the standalone task app (SHARED_SCHEMA.md §15). Rows, not config: add or rename a room here. Deactivate rather than delete.';
COMMENT ON COLUMN public.meeting_rooms.active IS
  'false hides the room from the booking form; its past reservations stay readable.';

INSERT INTO public.meeting_rooms (name, sort_order) VALUES
  ('Mala konferencija', 1),
  ('Velika konferencija', 2)
ON CONFLICT (name) DO NOTHING;

-- ---------- 2. reservations ----------
CREATE TABLE IF NOT EXISTS public.room_reservations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE RESTRICT,
  title      text NOT NULL DEFAULT '',
  start_at   timestamptz NOT NULL,
  end_at     timestamptz NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_reservations_end_after_start CHECK (end_at > start_at),
  CONSTRAINT room_reservations_max_24h CHECK (end_at <= start_at + interval '24 hours'),
  -- The guarantee. Half-open, so back-to-back bookings are fine.
  CONSTRAINT room_reservations_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
);

-- The exclusion constraint's gist index serves "what overlaps this slot". Listing a day's
-- bookings is a range scan on start_at, which wants a btree.
CREATE INDEX IF NOT EXISTS idx_room_reservations_start ON public.room_reservations (start_at);
CREATE INDEX IF NOT EXISTS idx_room_reservations_created_by ON public.room_reservations (created_by);

COMMENT ON TABLE public.room_reservations IS
  'One booking of one meeting room. Shared with the standalone task app (SHARED_SCHEMA.md §15). Overlaps on a room are refused by the database (23P01).';
COMMENT ON COLUMN public.room_reservations.title IS
  'Optional and public to every signed-in user. The client shows "Sastanak" when empty.';
COMMENT ON COLUMN public.room_reservations.created_by IS
  'auth user id (profiles.id), like tasks.created_by. Null once the user is deleted; then only an admin may edit or delete the row.';

-- updated_at by trigger. update_updated_at_column() is the baseline's generic helper
-- (SECURITY DEFINER, search_path public, pg_temp); it only writes NEW.updated_at.
DROP TRIGGER IF EXISTS room_reservations_set_updated_at ON public.room_reservations;
CREATE TRIGGER room_reservations_set_updated_at
  BEFORE UPDATE ON public.room_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3. RLS ----------
ALTER TABLE public.meeting_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_reservations ENABLE ROW LEVEL SECURITY;

-- Rooms: everybody reads, admins manage.
DROP POLICY IF EXISTS "Meeting rooms: anyone signed in can view" ON public.meeting_rooms;
CREATE POLICY "Meeting rooms: anyone signed in can view" ON public.meeting_rooms
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Meeting rooms: admin can insert" ON public.meeting_rooms;
CREATE POLICY "Meeting rooms: admin can insert" ON public.meeting_rooms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Meeting rooms: admin can update" ON public.meeting_rooms;
CREATE POLICY "Meeting rooms: admin can update" ON public.meeting_rooms
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Meeting rooms: admin can delete" ON public.meeting_rooms;
CREATE POLICY "Meeting rooms: admin can delete" ON public.meeting_rooms
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Reservations: everybody reads (that is the point of a board), anyone books as themselves,
-- the creator or an admin changes or removes.
DROP POLICY IF EXISTS "Room reservations: anyone signed in can view" ON public.room_reservations;
CREATE POLICY "Room reservations: anyone signed in can view" ON public.room_reservations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Room reservations: owner can insert" ON public.room_reservations;
CREATE POLICY "Room reservations: owner can insert" ON public.room_reservations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Room reservations: creator or admin can update" ON public.room_reservations;
CREATE POLICY "Room reservations: creator or admin can update" ON public.room_reservations
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Room reservations: creator or admin can delete" ON public.room_reservations;
CREATE POLICY "Room reservations: creator or admin can delete" ON public.room_reservations
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- ---------- 4. grants, saying the same as the policies ----------
REVOKE ALL ON public.meeting_rooms     FROM anon, authenticated;
REVOKE ALL ON public.room_reservations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_rooms     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_reservations TO authenticated;
GRANT ALL ON public.meeting_rooms, public.room_reservations TO service_role;
