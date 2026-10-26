# Backlog — tasks, calendar, chat, documents and AI assistant

Ids: `COLLAB-n` (next free: `COLLAB-15`). Entry format and rules are in [README.md](./README.md).

The `task*` tables are shared with the mobile task app; read
[../SHARED_SCHEMA.md](../SHARED_SCHEMA.md) before changing them. The AI assistant is pinned by
characterisation tests on `feature/voice-assistant`; its open questions (`OQ-n`) are tracked in
`docs/voice/open-questions.md` on that branch.

## Open

### COLLAB-14 · Low · Room reservations have no Cognilion surface
- **Check:** Decided 2026-10-27
- **Where:** `meeting_rooms` / `room_reservations` (migration `20261027100000`,
  [SHARED_SCHEMA.md §15](../SHARED_SCHEMA.md#15-meeting-rooms--meeting_rooms-and-room_reservations))
- **What happens:** the two conference rooms are booked from the task app only. A Cognilion
  user cannot see or book a room, and the Calendar page does not show that a room is taken.
- **Fix direction:** a read-only "Sobe" layer on the Calendar page is the natural first step
  (map `created_by`, an auth id, to `users` the way the task overlay does). Booking from
  Cognilion is the same insert the phone does. Do not reuse `calendar_events` for it — the
  migration header says why.

### COLLAB-12 · Low · A refused file delete goes unnoticed and leaves an orphan
- **Check:** Code reading (pre-release review, 2026-10-20)
- **Where:** `Documents/services/documentService.ts:351-354` (`deleteDocument`)
- **What happens:** the row is deleted first, then the file. Storage's `remove()` refused by RLS
  returns success with an empty array, and only `error` is checked, so the file stays with no row
  pointing at it and nothing is logged. Happens only when the row's uploader differs from the
  file's owner, which was never the case on production (18 of 18 on 2026-10-09).
- **Fix direction:** treat an empty result as a failure: log it with `logActivity` (severity high)
  and tell the user the file could not be removed.

### COLLAB-13 · Low · "Pitaj AI asistenta" from Help can send stale attachments
- **Check:** Code reading (pre-release review, 2026-10-20)
- **Where:** `AiChat/hooks/useAiChatStore.ts` `askInNewConversation` (around lines 605-617)
- **What happens:** it calls `newConversation()` and then `sendMessage()` in the same tick.
  `newConversation` clears the pending attachments in state and starts purging their uploaded
  files, but `pendingAttachmentsRef` only follows state after the next render, so `sendMessage`
  still reads the old list. Files waiting in the assistant's input go out with the Help question
  while they are being deleted — the send can fail or carry attachments that no longer exist.
- **Fix direction:** reset `pendingAttachmentsRef.current = []` in `askInNewConversation`, next to
  the other refs it resets by hand.

### COLLAB-4 · Medium · AI rate limiting miscounts
- **What happens:** tool-result rows are stored as `role = 'user'` and count against the
  20-per-5-minutes and 200-per-day limits; the check fails open on query errors and can be raced
  by concurrent requests.
- **Status:** deferred to the voice branch, where it is OQ-3. Change it with that work.

### COLLAB-10 · Low · Team calendars draw nothing
- **What happens:** ticking a teammate only feeds a sidebar hours figure, and that figure is wrong
  (three months of blocks in Month view, recurrence never expanded, declined invitations counted).
  `docs/CALENDAR.md` describes an overlay and RPC behaviour that do not exist.
- **Fix direction:** a real overlay needs a migration; fix `get_busy_blocks` (COLLAB-9) with it.

### COLLAB-9 · Low · `get_busy_blocks` ignores recurrence and RSVPs
- It does not expand recurring events, exclude private events or declined invitations, or merge
  overlaps.

### COLLAB-1 · Low · Calendar reminders are parked
- The field was removed from the UI on 2026-10-01 because nothing delivers reminders. To turn them
  on: shared-secret auth on the function (SEC-A9), a pg_cron job like `deadline-reminders`, skip
  declined invitees, mount the toast listener in Layout, and put the field back. See
  [../CALENDAR.md](../CALENDAR.md) → "Reminders (parked)".

### COLLAB-7 · Low · @mentions in task comments notify nobody

### COLLAB-6 · Low · Chat loads only the latest 50 messages
- No "load older"; no message edit or delete; no member management after creation.

### COLLAB-11 · Low · Documents shows UUID fragments instead of names
- `entity_id.slice(0,8)` for units, customers and companies.

### COLLAB-3 · Low · No filter node for uncategorised documents
- Only a count is shown. The edit action that lets users re-file a document is done.

### COLLAB-8 · Low · Document category seed data is not in the repo
- The baseline is schema-only; a fresh environment has an empty category tree.

### COLLAB-5 · Low · Assistant bugs pinned by the voice characterisation tests
- OQ-1 (stopping during a tool call breaks the branch) and OQ-2 (no tool says whether a TIC
  exists) are decided and will be fixed in voice phase 2. OQ-5 (`tool_result` emitted before it
  is persisted) is open. OQ-6 (`is_fully_paid` true when nothing is invoiced) is a chat bug
  outside that branch and has no owner yet.
