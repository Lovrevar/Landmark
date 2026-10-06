# Backlog — tasks, calendar, chat, documents and AI assistant

Ids: `COLLAB-n` (next free: `COLLAB-12`). Entry format and rules are in [README.md](./README.md).

The `task*` tables are shared with the mobile task app; read
[../SHARED_SCHEMA.md](../SHARED_SCHEMA.md) before changing them. The AI assistant is pinned by
characterisation tests on `feature/voice-assistant`; its open questions (`OQ-n`) are tracked in
`docs/voice/open-questions.md` on that branch.

## Open

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
