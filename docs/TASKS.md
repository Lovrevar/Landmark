# Module: Tasks

**Path:** `src/components/Tasks/`

## Overview

Simple shared task list (reworked 2026-07 after Director feedback that the original tool was too complex). Four tabs — **All tasks** (default), Assigned to me, Created by me, Private — with the list always grouped by project. Every authenticated user sees **all non-private tasks**; private tasks are visible only to their creator. Status is binary (open / done) toggled by a checkbox directly in the list. Tasks support project linkage, assignees, an optional due date, plain-text descriptions, drag-drop file attachments, and @mention comments. Task due-dates can additionally be surfaced as pill occurrences on the Calendar page via a per-user "Show tasks" toggle (that overlay stays personal: created + assigned only).

Removed in the rework: the `in_progress` ("u tijeku") status, reminders (never dispatched), the priority field (never had UI), the markdown description editor, the detail drawer's activity tab, and the sort/group/filter toolbar.

---

## Data Layer

Four tables (schema baseline + `20260706120000_simplify_tasks.sql` + `20260720120000_tasks_mobile_compat.sql`):

> ⚠️ **Shared schema with the standalone mobile task app.** All user columns
> in the task tables (`tasks.created_by`, `task_assignees.assignee_id`,
> `task_comments.user_id`, `task_attachments.uploaded_by`) hold **auth user
> ids** and FK to `public.profiles` (a mirror of `public.users` keyed by
> `auth_user_id`; email is trigger-synced, while `name`/`role` are owned by
> profiles — task-app admins are managed explicitly there, independent of
> Cognilion roles; new signups default to `role='user'`).
> The web app translates via `user.auth_user_id` from AuthContext; the
> activity log still uses `public.users.id` (see `TaskActor` in
> [types/tasks.ts](../src/types/tasks.ts)). Column names follow the mobile
> app: `deadline` (not `due_date`) and `completed` boolean (not `status`).

- `tasks` — carries `project_id`, `description_format ('markdown'|'plain')`; `completed` boolean; `completed_at` flips with it. `deadline` is the due date. New descriptions are always saved as `plain`; legacy `markdown` rows still render through `MarkdownView`. `due_time` remains in the schema for legacy Calendar rendering but has no UI (and is invisible to the mobile app). `color` is a nullable label colour constrained to six values by `tasks_color_check` — see [Colours](#colours)
- `task_assignees` — junction (`assignee_id`, composite PK `(task_id, assignee_id)` so PostgREST supports the mobile app's flat `profiles!task_assignees` embed; surrogate `id` kept as UNIQUE for web delete-by-id) with `acknowledged_at` (badge clears on visit). The mobile app creates and edits tasks via the `create_task_with_assignees(...)` / `update_task_with_assignees(...)` RPCs, which exist here too but which the web paths do not use (see [Editing](#editing-create-vs-update-rpcs))
- `task_reminders` — scheduler bookkeeping for [deadline reminders](#deadline-reminders), keyed `(task_id, kind, sent_on)`. No client reads it; `REVOKE ALL` from `anon`/`authenticated`
- `task_comments` — thread per task; bodies may embed `@[username](uuid)` mention tokens
- `task_attachments` — storage metadata for files in the private `task-attachments` Storage bucket (25 MB/file, 10/task)

### Visibility & edit rights (RLS)

- **SELECT**: all authenticated users can view non-private tasks; private tasks only creator/assignees. Child tables (`task_assignees`, `task_comments`, `task_attachments`, and the storage read policy) follow the parent task via the `public.can_view_task(task_id, user_id)` SECURITY DEFINER helper. Policies compare `auth.uid()` directly (no `users` subquery)
- **UPDATE**: creator, assignee, or admin (`public.is_admin()`, i.e. `profiles.role='admin'`) — the UI mirrors creator/assignee as `canEdit`; admin rights exist for the mobile app
- **INSERT/DELETE** on tasks: creator (delete also admin); comment/attachment INSERT: assignee or creator only

Every mutation is logged through `logActivity()` with `entity='task'` and action `task.<verb>` (create / update / status_change / delete / assign / unassign / comment / attachment_add / attachment_remove). Colour changes ride on `task.update` with `changed_fields: ["color"]`.

### Colours

`tasks.color` is a *label*, not a status — a supervisor grouping tasks by eye ("the blue ones are the electrics"). The overdue red left border stays deadline-driven and must not become paintable, so the chip is rendered squared-off (`rounded-md`, no clock) to stay legible beside a red deadline.

The palette is **closed at three points that must be changed together**: `tasks_color_check` in `20260813090000_task_color.sql`, `COLOR_STYLES` in [taskColor.ts](../src/components/Tasks/taskColor.ts), and `src/lib/taskColor.ts` in the mobile app. The reason it cannot be a free hex string is Tailwind: utility classes are emitted by scanning sources for literal class names, so a class assembled at runtime (`bg-${color}-100`) is never generated and the chip would render with no background. `NULL` means "no colour" — no backfill, no default, and a CHECK passes on NULL.

Labels live in the locale files under `tasks.colors.*` rather than in `taskColor.ts`, because Cognilion ships English and Croatian while the mobile app is Croatian-only.

### Editing: create vs. update RPCs

Two RPCs exist for the mobile app, which has no direct write path of its own:

- `create_task_with_assignees(p_title, p_description, p_project_id, p_deadline, p_assignee_ids, p_color)` — SECURITY INVOKER, requires ≥1 assignee. `p_color` was appended last with a DEFAULT so an old client bundle calling the five-argument form keeps working
- `update_task_with_assignees(p_task_id, p_title, p_description, p_project_id, p_deadline, p_color, p_assignee_ids)` — SECURITY DEFINER (and therefore carrying its own "creator or admin" check, since DEFINER bypasses RLS). Reassignment is a set difference, not a wipe-and-reinsert, so rows that did not change keep their `created_at` **and their `acknowledged_at`**

⚠️ **Argument names and order are a contract with the mobile client** — PostgREST resolves overloads by named arguments, so renaming or reordering breaks it.

⚠️ **One deliberate divergence from the mobile app's migration.** Its `20260812091000_task_edit.sql` also narrows the column privileges (`REVOKE UPDATE ON tasks FROM authenticated; GRANT UPDATE (completed, completed_at)`), forcing every non-completion write through the RPC. Cognilion's `TaskDetail` autosaves each field with a direct PATCH — and writes `updated_at` on every save, the completion toggle included — so that grant would break the editor *and* the toggle with "permission denied for table tasks". `20260813091000_task_edit_rpc.sql` ships the RPC without it and says so in its header. If the drawer is ever refactored onto the RPC, add the two statements then, and remember that any column a later migration adds would need its own GRANT.

### services/tasksService.ts

Mutations take a `TaskActor` (`{ id, auth_user_id, role }` — the AuthContext user object) so they can write auth ids into task tables while logging with the app user id.

- `fetchTaskUsers()` — user list for pickers; `TaskUser.id` is the **auth user id** (`id:auth_user_id` alias, rows without an auth account filtered out)
- `fetchProjectOptions()` — project list for the project linkage field
- `fetchAllTasks()` — single select; RLS scopes visibility (all public + own private tasks); hydrated with creator, assignees, attachments, comment count
- `fetchTasksInRange(authUserId, fromIso, toIso)` — created + assigned tasks with `deadline` inside the window; used by the Calendar overlay (intentionally personal, not org-wide)
- `createTask(input, actor)` — inserts a task (`completed: false`, `description_format: 'plain'`, `color` from the picker) + assignee rows (or a single self-row for private); logs `task.create`
- `updateTask(taskId, updates, actor, title?)` — patches a task (`completed` also flips `completed_at`); logs `task.update` with `changed_fields`
- `updateTaskCompleted(taskId, completed, actor?, title?)` — completion-only patch; writes `completed_at`; logs `task.status_change`
- `deleteTask(taskId, actor?, title?)` — cascade remove; logs `task.delete` (high severity)
- `setAssignees(taskId, ids, actor)` — diff-based add/remove (ids are auth ids); logs `task.assign` / `task.unassign`
- `fetchTaskComments(taskId)` / `createTaskComment(taskId, actor, comment)` / `deleteTaskComment` — thread CRUD; `createTaskComment` logs `task.comment`
- `listTaskAttachments` / `uploadTaskAttachment(taskId, file, actor)` / `deleteTaskAttachment(id, actor)` / `getAttachmentSignedUrl` — attachment CRUD with 25 MB + 10-per-task enforcement; logs `task.attachment_add` / `task.attachment_remove`. Bucket constant: `TASK_ATTACHMENTS_BUCKET = 'task-attachments'`
- `getUnacknowledgedTaskCount(authUserId)` / `acknowledgeAllTasks(authUserId)` — global badge helpers
- **Depends on:** supabase client, activityLog
- **Logs:** every mutation listed above

---

## Hooks

### hooks/useTasks.ts
- `useTasks()` — loads `fetchAllTasks()` on mount; also calls `acknowledgeAllTasks` + `dispatchTasksRead` once per session so opening `/tasks` clears the badge
- Exposes `tasks`, `loading`, and mutation callbacks: `create`, `update`, `setCompleted`, `toggleStatus` (open ↔ done, the checkbox handler), `remove`, `refresh`. All mutations call `load()` after success so the list is always source-of-truth
- View state (search, show-completed, collapsed groups) lives in [index.tsx](../src/components/Tasks/index.tsx); `showCompleted` + `collapsed` persist per-user to `localStorage` under `tasks.view.${userId}` (the legacy `tasks.filters.${userId}` key is removed on mount)

### hooks/useTasksRealtime.ts
- `useTasksRealtime(userId, onChange)` — subscribes to four Supabase realtime channels: `tasks`, `task_assignees` (filtered to the current user), `task_comments`, `task_attachments`. Changes are debounced (300 ms) into a single `onChange` because the broadened RLS makes the unfiltered channels fire for everyone's edits
- Caller controls when to refresh — `TasksPage` wires it to `refresh` from `useTasks`

### hooks/useTaskComments.ts
- `useTaskComments(taskId)` — comments list + draft + send / delete for a single task

### hooks/useTasksNotifications.ts
- `useTasksNotifications()` — powers the global red badge
- Polls `getUnacknowledgedTaskCount` every 20 s; listens for `tasks:marked-read` window events
- Exports `dispatchTasksRead()` helper
- **Mounted in:** [Layout.tsx](../src/components/Common/Layout.tsx) (global)

---

## Views

### index.tsx (TasksPage)
- Header + "New task" button (`ui/Button`), then `ui/Tabs`: **All** (default) / Assigned to me / Created by me / Private, each with a live count. The tab always resets to All on entry
- Toolbar is intentionally minimal: `ui/SearchInput` + "Show completed" `ui/ToggleSwitch` (defaults ON; completed tasks sort to the bottom of their group instead of vanishing)
- List is **always grouped by project** (alphabetical, "no project" last). Within a group: open tasks by due date asc (no due date last), then completed tasks by completion desc
- Group headers are **collapsible** (chevron; collapsed set persisted per-user) and show a task count plus a red **"N overdue"** chip when applicable
- A **quick-add input** sits at the top of each expanded project group (type a title + Enter → creates an open task in that project; creates a private task on the Private tab; hidden on the Assigned tab where the new task would not appear)
- `canEdit` (creator or assignee) is computed per task and drives the row checkbox / delete affordances
- When `rows.length > 100` the list is virtualized via `@tanstack/react-virtual` with mixed header / quick-add / row heights; below the threshold it renders as a plain flow
- Selected task renders in `TaskDetail` drawer; new task flow opens `TaskModal`; delete flows through a shared `ConfirmDialog`; empty list uses `ui/EmptyState`
- **Uses hooks:** useTasks, useTasksRealtime, useAuth
- **Uses components:** TaskRow, TaskModal, TaskDetail
- **Uses UI:** Tabs, Button, SearchInput, ToggleSwitch, ConfirmDialog, EmptyState

### TaskRow.tsx
- Compact row: **checkbox** (Square/CheckSquare; disabled with a "read only" tooltip when the viewer can't edit) toggling open ↔ done, title (strikethrough when done), unread dot, lock icon for private, colour chip, red left accent + relative due label when overdue, attachment/comment counts, stacked avatars via [AvatarStack](../src/components/ui/AvatarStack.tsx), creator-only hover delete. No project tag — the group header carries the project

### TaskModal.tsx
- **Create-only** modal (editing happens inline in the detail drawer). Fields: title, project ([SearchableSelect](../src/components/ui/SearchableSelect.tsx)), optional due date (date only), colour ([TaskColorPicker](../src/components/Tasks/components/TaskColorPicker.tsx)), private toggle, assignees ([ParticipantPicker](../src/components/Calendar/components/ParticipantPicker.tsx), hidden for private tasks), plain-text description (`ui/Textarea`)
- Ctrl+Enter submits; Esc cancels with dirty-state confirm; attachments hint points at the detail drawer

### TaskDetail.tsx
- Slide-from-right drawer via `createPortal`; inline-editable fields auto-save on change. Header row has a large done-checkbox next to the title
- Fields: title, project, due date (date only), colour, private toggle, assignees, plain-text description (legacy markdown rows still render via `MarkdownView`; edits save as `plain`). Read-only viewers see the colour chip instead of the picker, and no colour row at all when the task has none
- Comments section (no tabs): [MentionPicker](../src/components/Tasks/components/MentionPicker.tsx) composer with `@` autocomplete; mention tokens rendered via `renderCommentWithMentions`. Composer hidden for read-only viewers (matches RLS)
- **Read-only mode** when the viewer is neither creator nor assignee: all inputs disabled, no attachment mutations, no comment composer, no delete
- ⚠️ Prop contract `{ task, onClose, onDelete, onChanged }` is shared with [Calendar/index.tsx](../src/components/Calendar/index.tsx) — keep it stable
- **Uses hooks:** useTaskComments, useAuth
- **Uses components:** AttachmentList, MarkdownView, MentionPicker, mentions

### components/AttachmentList.tsx
- Drag-drop zone, signed-URL image thumbnails, per-file progress + delete (RLS-enforced via the passed `canDelete(attachment)` predicate), 25 MB + 10-file client caps
- Requires a persisted `taskId` — create flow adds attachments from the detail drawer after save

### taskColor.ts, components/TaskColorChip.tsx, components/TaskColorPicker.tsx
- `taskColor.ts` — the closed palette: `TaskColor` union, `TASK_COLORS` (value + locale key, swatch order), `COLOR_STYLES` (full literal Tailwind classes, light + dark), `isTaskColor()` guard for the plain-text column
- `TaskColorChip` — the chip beside the deadline; `dotOnly` renders just the dot for the calendar pill. Returns `null` for a null/unknown colour
- `TaskColorPicker` — six swatches + a "no colour" button; clicking the selected swatch clears it

### components/MentionPicker.tsx, components/mentions.ts
- Textarea with `@` detection popover + arrow-key navigation. Mentions are stored inline as `@[username](uuid)` tokens
- `renderCommentWithMentions(comment)` returns a `{ type: 'text' | 'mention', value, userId? }[]` sequence for the renderer

---

## Notes
- Acknowledge semantics: opening `/tasks` clears the current user's badge via `acknowledgeAllTasks` + `dispatchTasksRead` (once per mount)
- Private tasks skip the assignee picker; the creator becomes the sole pre-acknowledged assignee
- The calendar's `TaskPill` flips completed on/off, same as the list checkbox, and shows the colour as a dot
- Comment mention notifications are deferred until a notifications table exists (tracked in [`docs/rand/tasks-redesign-plan.md`](./rand/tasks-redesign-plan.md) §11)
- Migration `20260706120000_simplify_tasks.sql` (data: `in_progress` → `todo`; drops `reminder_offsets`, `priority`, `task_reminder_sends`; broadens SELECT policies) must be applied by a human — after applying, regenerate types with `npm run db:types`
- Migrations `20260720120000_tasks_mobile_compat.sql` (profiles mirror + `is_admin()`, task tables → auth-id space, `status` → `completed`, `due_date` → `deadline`, RLS on `auth.uid()`) and `20260720130000_task_assignees_mobile_compat.sql` (`user_id` → `assignee_id`, composite PK, `create_task_with_assignees` RPC) must be applied by a human — the frontend on this branch **requires** both. The colleague's standalone mobile app points at this same schema; its own migrations in `todoMigrations/` must **never** be run against this DB
- Migrations `20260813090000_task_color.sql` (the `color` column + `p_color` on the create RPC), `20260813091000_task_edit_rpc.sql` (`update_task_with_assignees`) and `20260813092000_deadline_reminders.sql` mirror the mobile app's `20260812090000/091000/092000`, **adapted** — this repo is the source of truth for the shared database, and the mobile repo's three copies must not be pushed to it. Apply by hand, then `npm run db:types`. The reminders one has manual prerequisites; see below

## Web Push

Task notifications reach a phone's lock screen through the mobile app. Cognilion **sends but does not receive** — it has no service worker, so a Landmark user triggers pushes for others and never gets one itself. Because the mobile app runs against **this** database, the server half lives here, not in the colleague's Supabase project:

- Migration `20260729120000_push_subscriptions.sql` — `push_subscriptions` (one row per opted-in device, `endpoint` as PK) plus `save_push_subscription()`. Must be applied by a human, then regenerate types with `npm run db:types`
- Edge function [`supabase/functions/send-push/`](../supabase/functions/send-push/index.ts) — re-reads the task with the service role, works out recipients, excludes the actor, encrypts one message per device. Needs the `VAPID_KEYS` and `VAPID_SUBJECT` secrets set on this project (and `REMINDER_SECRET`, below). It is the only place dead endpoints get pruned (on 404/410; 403 is a key mismatch, deliberately not pruned)
- `topicFor(tag)` sets the RFC 8030 Topic header, which caps at **32 characters** of URL-safe base64 — a raw UUID is 36 with its hyphens. Stripping them lands on exactly 32, and the reminder tag (`<uuid>:reminder`) would truncate to the *same* 32, so a reminder could collapse onto an unread "Novi zadatak" at the push service. Swapping the first character for `r` keeps the two apart while still collapsing reminders about one task onto each other
- RLS on `push_subscriptions` is owner-scoped for SELECT and DELETE with **no INSERT/UPDATE policy** — a subscription is a capability to write to someone's lock screen. All writes go through `save_push_subscription()` (SECURITY DEFINER), which deletes by endpoint before inserting so a shared site phone can change hands; a plain upsert would hit a unique violation against a row RLS makes invisible
- This is the one file in `todoMigrations/` whose content is safe here, so it has a Landmark-owned counterpart with the same name. The rule above is unchanged: run **this** copy, not that one
- [`services/pushNotify.ts`](../src/components/Tasks/services/pushNotify.ts) — `notify(event, taskId, newAssigneeIds?)`, fire-and-forget by contract: a failed push must never fail the task write. Follows the edge-function call pattern in `AiChat/services/aiChatService.ts` (session token + `Authorization` *and* `apikey` headers). Needs no new env var — `VITE_SUPABASE_URL` only
- Four triggers, all in `tasksService.ts`: `createTask` and `setAssignees` → `task_assigned`; `updateTaskCompleted` and `updateTask` → `task_completed` on the flip to done only, never on re-open. Everything above the service layer (useTasks, TaskDetail, the calendar's TaskPill) notifies for free
- ⚠️ In `createTask` the call must stay **after** the `task_assignees` insert — the function reads assignees from the DB, so firing earlier notifies nobody. The mobile app avoids this with an atomic RPC; we insert in two steps
- `setAssignees` passes `newAssigneeIds` so only the people just added are told. The function **intersects** it with the assignees it read itself: the client can narrow the fan-out but never widen it, so the "client cannot push arbitrary content to arbitrary people" property holds. The mobile app never sends the field
- Receiving in Landmark is not implemented — it would need PWA/service-worker infrastructure this repo does not have. The table and RPC already support it; the mobile app's `src/lib/push.ts` and `src/sw.ts` are a working reference
- Notification text is built server-side in Croatian by `buildPayload()`. Correct while every recipient is a mobile-app user; revisit if Landmark ever receives

## Deadline reminders

Tasks with a deadline notify on their own: the day before, on the morning of, and every morning after while the task is late. Assignees get all three; an overdue task also reaches whoever created it, so a supervisor sees slippage without going looking for it. Completed tasks generate nothing, and the overdue nag stops after 30 days — a task that has nagged every morning for three months has taught everyone to swipe it away without reading.

`20260813092000_deadline_reminders.sql` adds `task_reminders` and `dispatch_due_reminders(p_force)`, scheduled hourly by `pg_cron`. Read that file's header for the full reasoning; the short version:

- **The primary key is the logic.** `(task_id, kind, sent_on)` *is* the once-per-day rule; a moved deadline needs no cleanup because the new date is a different `sent_on`; claiming is one race-free `INSERT … ON CONFLICT DO NOTHING RETURNING`
- **`pg_net`, not an external scheduler.** `net.http_post()` only queues a row that a worker picks up *after commit*, so the claim and the send share one transaction. A reminder can be lost, never duplicated — and the overdue kind heals itself the next morning
- **Hourly job, local-hour gate.** `cron.schedule` runs in UTC and Croatia changes offset twice a year, so the function gates on the Europe/Zagreb hour (07–09, wide because repeat runs are free and turn 08:00 into a catch-up)
- **Cognilion specifics:** a private task's creator is its sole assignee, so it reminds only its owner; a quick-added task with no assignees claims a row and tells nobody until it goes overdue, when the creator hears about it
- **Authentication:** a scheduled call passes two gates — the service-role bearer gets past the gateway's `verify_jwt`, and `x-reminder-secret` is what the function itself checks. They are separate so the credential that bypasses RLS is not the one you must rotate if a header leaks into a log. `send-push` also cross-gates mode against event: a `reminder_*` may only come from the scheduler, a user event only from a user

### One-time setup (not in the migration — these are secrets)

1. **Dashboard → Database → Extensions**: enable `pg_cron` and `pg_net`
2. Deploy the function **first**, then give it the secret:
   ```bash
   supabase functions deploy send-push
   openssl rand -base64 32                       # keep this value
   supabase secrets set REMINDER_SECRET=<value>
   ```
3. In the SQL editor, store what the dispatcher needs:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'send_push_url');
   select vault.create_secret('<service_role key>', 'send_push_service_key');
   select vault.create_secret('<the same REMINDER_SECRET>', 'reminder_secret');
   ```
4. Only now apply the migration. ⚠️ **Order matters**: a dispatcher that fires at a version of the function which rejects `reminder_*` has already committed its claims, and that morning's reminders are gone

### Testing without waiting for tomorrow

```sql
select public.dispatch_due_reminders(true);   -- true skips the hour gate
select * from public.task_reminders;          -- one row per claim, sent_on = today
select public.dispatch_due_reminders(true);   -- returns 0: nothing is claimed twice
select status_code, content from net._http_response order by created desc limit 5;
```

To re-arm a task, delete its `task_reminders` rows. The test worth not skipping is the failure path: **break one of the vault secrets, dispatch, and confirm `task_reminders` gains no rows** — that is the transactional guarantee the whole `pg_net` choice rests on. Also worth one check: POST `reminder_overdue` to `send-push` with an ordinary user JWT and confirm a 403.
