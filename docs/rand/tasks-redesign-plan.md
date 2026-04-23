# Tasks Redesign + Calendar Toggle — Design Doc

**Status:** draft for sign-off · **Scope:** Tasks module + Calendar overlay · **Stage:** dev (schema is free to change)

This is the Step 1 design doc. Please read, mark things to change, and approve. No code, migrations, or dependency installs will happen until this is signed off.

---

## 1. Why this work

The Calendar was redesigned in phases 1–4 and now has: per-occurrence RSVP, recurrence, reminders dispatched by a scheduled Edge Function, rich pills in Month/Week/Day/Agenda views, a `NextUp` sidebar, and a real-time subscription. Tasks was skipped.

Today's Tasks page is flat by comparison:
- Binary checkbox (`status` actually has four values but only todo/done are used meaningfully).
- No project linkage, no attachments, no activity history surfaced anywhere.
- Plain-text description, no @mentions.
- No search, no filters, no sort, no group-by.
- Queries are inline in `useTasks`, no service layer, no `logActivity()` calls.
- No real-time subscription; the page only reflects the local user's own actions.
- No way to see a task's deadline on the calendar alongside events — people have to switch pages to find out "what's due today."

The redesign brings Tasks to parity and adds a calendar toggle so deadlines appear where the user is already looking.

Tasks stays on its own page. We do **not** merge `tasks` into `calendar_events`. The calendar overlay is a read-only projection.

---

## 2. Current state of the Tasks code

| File | Role |
|---|---|
| [src/components/Tasks/index.tsx](src/components/Tasks/index.tsx) | Page shell, 3 tabs (Mine / Team / Overdue), pulls from `useTasks`. |
| `src/components/Tasks/hooks/useTasks.ts` | Inline Supabase queries, no service layer, no real-time. |
| `src/components/Tasks/TaskModal.tsx` | Minimal create/edit modal: title, description, due date, assignee, status. |
| `src/components/Tasks/TaskItem.tsx` | Row with checkbox, title, due date, small assignee avatar. |
| `src/types/tasks.ts` | `Task` type + `TaskStatus = 'todo'\|'in_progress'\|'done'\|'cancelled'` (cancelled never surfaces in the UI). |
| `supabase/migrations/.../create_tasks_and_calendar_tables.sql` | Creates `tasks`, `task_assignees`, `task_comments`, and the `is_task_assignee` / `get_task_creator` RLS helpers. |

The tasks schema already has good bones (RLS helpers, comments table, assignees join) — we extend it, not replace it.

Known issues found during audit:
- `task_comments.user_id` references `auth.users(id)` in some migrations and `public.users(id)` elsewhere; the user-join code has to special-case this. We fix in the new migration.
- `TaskStatus` has `cancelled` but nothing in the UI renders or filters it. Dropping it simplifies the status pill.
- `task` is not registered in `ENTITY_ROUTE_MAP`; even if we started logging, links from the Activity Log viewer wouldn't resolve.

---

## 3. What we reuse from the Calendar work

| Calendar artifact | How Tasks reuses it |
|---|---|
| `ParticipantPicker` (searchable multi-select of users) | Renamed `AssigneePicker`; same UI, different write target. |
| `relativeLabel.ts` util (extracted in phase 4) | Identical usage: "Today at 4pm", "in 2 days", "3 days ago". |
| `ConfirmDialog` | Delete task, discard unsaved changes. |
| `SearchableSelect` | Project picker, reminder preset picker. |
| `SegmentedControl` | The 3-state status pill (click-to-cycle). |
| `ToggleSwitch` | "Show completed" and "Show tasks on calendar". |
| `useCalendarPreferences` pattern | Extend the same hook to hold `showTasks` boolean. |
| Real-time subscription shape in `useEventsInRange.ts` | Model for `useTasksRealtime` — same "one channel per filter predicate" trick. |
| `dispatch-calendar-reminders` Edge Function | Forked into `dispatch-task-reminders` — nearly identical, keyed off `tasks.reminder_offsets` and `due_date`. |
| `uploadAttachment` in `chatService.ts` (25 MB cap, Supabase Storage) | Forked into `taskService.uploadAttachment` against a new `task-attachments` bucket. |
| `logActivity()` | Tasks start emitting `task.<verb>` entries on every mutation. |
| RLS helpers `is_task_assignee(task_id, user_id)` / `get_task_creator(task_id)` | Already exist — reused in the new `task_attachments` policies. |

No calendar code is modified by the Tasks work except the toolbar (adds a toggle) and the views (accept an optional `taskOccurrences` prop).

---

## 4. Schema additions

One migration, named `<ts>_tasks_redesign.sql`.

**`tasks` table additions:**
- `project_id uuid NULL REFERENCES projects(id) ON DELETE SET NULL`
- `reminder_offsets integer[] NOT NULL DEFAULT '{}'` — minutes before `due_date`
- `description_format text NOT NULL DEFAULT 'markdown' CHECK (... IN ('markdown','plain'))`
- Drop `cancelled` from the status check; migrate any existing rows to `done` (dev DB has none)
- Indexes on `project_id` and partial index on `due_date WHERE due_date IS NOT NULL`

**New table `task_attachments`:**
- `(id, task_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, created_at)`
- RLS: read/insert/delete restricted to assignees + creator via the existing helpers
- Added to `supabase_realtime` publication

**New table `task_reminder_sends`:**
- `(task_id, offset_min, sent_at)` with a unique key — idempotency for the reminder dispatcher, mirrors the calendar version

**`task_comments.user_id` fix:**
- Swap the FK to reference `public.users(id)` consistently so `@mention` resolution uses the same user type as everywhere else

**No new activity-log table.** Task mutations use the existing generic `activity_log` + `logActivity()` + register `task` in `ENTITY_ROUTE_MAP`.

**Storage:** one new private bucket, `task-attachments`, 25 MB per file, 10 files per task (capped client-side).

---

## 5. Calendar toggle — mechanics

**Where it lives in the UI:** the calendar toolbar, right-hand side, as a `ToggleSwitch` labelled "Show tasks". Off by default. Persisted per user in the existing `useCalendarPreferences` hook.

**Two queries, not one.** Events and tasks stay separate at the data layer:
1. `useEventsInRange(from, to)` — unchanged. Returns events + exceptions + occurrence responses, expanded into `ExpandedOccurrence[]`.
2. `useTasksInRange(from, to, filters)` — new. Returns tasks whose `due_date` falls in the window. Expanded by `expandTasks()` into `TaskOccurrence[]` (trivial — tasks have no RRULE, each task is one occurrence).

The views receive `taskOccurrences?: TaskOccurrence[]` as an optional prop. If the toggle is off, the parent doesn't fetch tasks and doesn't pass the prop, so there's no extra work.

Calendar filter bar (project / assignee) applies to **both** event participants and task assignees when the toggle is on.

**Rendering rules per view:**

| View | Task placement |
|---|---|
| Month | Below event pills in each day cell. Thinner pill (`h-4`), checkbox icon prefix (`Square`/`CheckSquare`), red left accent when overdue, strikethrough title when done. |
| Week / Day | All-day lane at the top — tasks are deadlines, not time-boxed blocks. |
| Agenda | Interleaved with events, sorted by time; task rows have the checkbox icon prefix. |
| NextUp sidebar | Includes tasks due within 24 h when the toggle is on. |

**Click behaviour:**
- Click task pill body → opens `TaskDetail` drawer (new, slides in from right). Does NOT open the event modal.
- Click checkbox icon → optimistic `todo ↔ done` toggle via `updateStatus`.

**Real-time:** the same `useTasksRealtime(userId)` the Tasks page uses keeps the calendar projection fresh.

---

## 6. Tasks page redesign (summary)

Header toolbar: tabs, search (200 ms debounce on title + description), filter dropdown (Status / Project / Assignees), sort dropdown (Due / Created / Title), group-by (None / Project / Status / Due), "Show completed" toggle, "New task" primary button. All state persisted to `localStorage` keyed by user id.

Task row: red accent bar if overdue, 3-state status pill, title (strikethrough if done), project chip, relative due label, attachment icon+count, unread-comment blue dot, stacked avatars (3 + `+N`), hover overflow menu.

Virtualization: `@tanstack/react-virtual` above 100 rows.

Modal: Title, Status segmented, Project, Due date, Reminders (chip list with presets 5 / 15 / 60 / 1440 / 2880 min + custom), Assignees, Attachments (drag-drop, image thumbs, progress bars), Description (markdown with Edit / Preview tabs). Ctrl+Enter submits, Esc with dirty-state confirmation.

Detail drawer: inline-editable fields, attachment previews, Activity tab (filtered `activity_log`, collapsed to last 3), Comments tab with @mentions (inline `@[Name](uuid)` markers, clickable chips, notifications emitted on insert), delete button.

---

## 7. New dependencies

- `react-markdown` + `remark-gfm` — markdown rendering for task descriptions and comments.
- `@tanstack/react-virtual` — list virtualization above 100 rows.

No other third-party libraries are added.

---

## 8. Verification plan (end-to-end)

1. `npm run lint && npx tsc -b --noEmit` clean for all touched files.
2. Apply migration locally; sanity-check `task_comments.user_id` after the FK swap.
3. Create a task with every field populated (status, project, due date, reminders, multiple assignees, attachments, markdown description); verify the row renders correctly, `activity_log` has a `task.create` entry, attachments upload and download.
4. Cycle status via the pill; confirm `activity_log` gets `task.status_change`.
5. Test filter / search / sort / group persistence across reloads; "Show completed" hides done items.
6. Seed 150 tasks; scroll — no jank, virtualization active.
7. Two browsers as same user — edit in one, change appears in the other within 1 s.
8. Set `reminder_offsets = [15]`, due in 16 min; Edge Function sends one notification; re-running produces none (idempotency).
9. Toggle "Show tasks" on the calendar; Month / Week / Day / Agenda / NextUp all render tasks per §5 rules. Clicking a task pill opens the task drawer.
10. `@mention` a user in a comment; target user receives a notification.

The detailed test script will land in `docs/test/08-collaboration.md`.

---

## 9. Open questions

Please confirm or redirect before execution:

1. **Notification delivery for @mentions.** We'll use the existing `notifications` table. Is there an existing `type` value we should use (e.g. `mention`, `task.mention`), or add a new one? — needs a quick look at that table's shape as the first step of execution.
2. **Croatian translations.** EN keys will be drafted first. The ambiguous ones we'd like to batch-ask: *overdue, reminder, attachments, activity, mentions, drag & drop files, Show tasks on calendar*. OK to defer the HR pass to the end?
3. **Dropping `cancelled` from `TaskStatus`.** Dev DB has no such rows; we simplify the enum. If there's any reason to keep `cancelled` as a fourth state (e.g. a report mentions it), flag now.
4. **Reminder cadence for `dispatch-task-reminders`.** Calendar runs every 5 min. Fine to match that? (Tasks don't need finer resolution.)
5. **Test doc file name.** The brief says `02-collaboration.md`; the actual file is `08-collaboration.md`. Assuming this was a typo — we'll update `08-`.
6. **Markdown sanitisation.** `react-markdown` disables raw HTML by default. Keeping that default — no `rehype-raw`. OK?
7. **Do tasks on the calendar respect the `showDeclined`-style visibility filters, or just project/assignee?** Current assumption: only project/assignee, since tasks have no RSVP concept.

---

## 10. What happens after approval

Execution in the order from the brief:
- Step 2 — Tasks list page redesign (+ schema migration + service layer + types).
- Step 3 — Create/edit modal + detail drawer.
- Step 4 — Calendar toolbar toggle + task rendering on all calendar views.
- Step 5 — Finishing: update `docs/modules/` docs, extend `docs/test/08-collaboration.md`, seed SQL.

Estimated new/changed files: ~25. Full list is in the approved implementation plan.
