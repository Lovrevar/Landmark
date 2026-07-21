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

- `tasks` — carries `project_id`, `description_format ('markdown'|'plain')`; `completed` boolean; `completed_at` flips with it. `deadline` is the due date. New descriptions are always saved as `plain`; legacy `markdown` rows still render through `MarkdownView`. `due_time` remains in the schema for legacy Calendar rendering but has no UI (and is invisible to the mobile app)
- `task_assignees` — junction (`assignee_id`, composite PK `(task_id, assignee_id)` so PostgREST supports the mobile app's flat `profiles!task_assignees` embed; surrogate `id` kept as UNIQUE for web delete-by-id) with `acknowledged_at` (badge clears on visit). The mobile app creates tasks via the `create_task_with_assignees(...)` RPC, which exists here too (SECURITY INVOKER; requires ≥1 assignee — the web create path does not use it)
- `task_comments` — thread per task; bodies may embed `@[username](uuid)` mention tokens
- `task_attachments` — storage metadata for files in the private `task-attachments` Storage bucket (25 MB/file, 10/task)

### Visibility & edit rights (RLS)

- **SELECT**: all authenticated users can view non-private tasks; private tasks only creator/assignees. Child tables (`task_assignees`, `task_comments`, `task_attachments`, and the storage read policy) follow the parent task via the `public.can_view_task(task_id, user_id)` SECURITY DEFINER helper. Policies compare `auth.uid()` directly (no `users` subquery)
- **UPDATE**: creator, assignee, or admin (`public.is_admin()`, i.e. `profiles.role='admin'`) — the UI mirrors creator/assignee as `canEdit`; admin rights exist for the mobile app
- **INSERT/DELETE** on tasks: creator (delete also admin); comment/attachment INSERT: assignee or creator only

Every mutation is logged through `logActivity()` with `entity='task'` and action `task.<verb>` (create / update / status_change / delete / assign / unassign / comment / attachment_add / attachment_remove).

### services/tasksService.ts

Mutations take a `TaskActor` (`{ id, auth_user_id, role }` — the AuthContext user object) so they can write auth ids into task tables while logging with the app user id.

- `fetchTaskUsers()` — user list for pickers; `TaskUser.id` is the **auth user id** (`id:auth_user_id` alias, rows without an auth account filtered out)
- `fetchProjectOptions()` — project list for the project linkage field
- `fetchAllTasks()` — single select; RLS scopes visibility (all public + own private tasks); hydrated with creator, assignees, attachments, comment count
- `fetchTasksInRange(authUserId, fromIso, toIso)` — created + assigned tasks with `deadline` inside the window; used by the Calendar overlay (intentionally personal, not org-wide)
- `createTask(input, actor)` — inserts a task (`completed: false`, `description_format: 'plain'`) + assignee rows (or a single self-row for private); logs `task.create`
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
- Compact row: **checkbox** (Square/CheckSquare; disabled with a "read only" tooltip when the viewer can't edit) toggling open ↔ done, title (strikethrough when done), unread dot, lock icon for private, red left accent + relative due label when overdue, attachment/comment counts, stacked avatars via [AvatarStack](../src/components/ui/AvatarStack.tsx), creator-only hover delete. No project tag — the group header carries the project

### TaskModal.tsx
- **Create-only** modal (editing happens inline in the detail drawer). Fields: title, project ([SearchableSelect](../src/components/ui/SearchableSelect.tsx)), optional due date (date only), private toggle, assignees ([ParticipantPicker](../src/components/Calendar/components/ParticipantPicker.tsx), hidden for private tasks), plain-text description (`ui/Textarea`)
- Ctrl+Enter submits; Esc cancels with dirty-state confirm; attachments hint points at the detail drawer

### TaskDetail.tsx
- Slide-from-right drawer via `createPortal`; inline-editable fields auto-save on change. Header row has a large done-checkbox next to the title
- Fields: title, project, due date (date only), private toggle, assignees, plain-text description (legacy markdown rows still render via `MarkdownView`; edits save as `plain`)
- Comments section (no tabs): [MentionPicker](../src/components/Tasks/components/MentionPicker.tsx) composer with `@` autocomplete; mention tokens rendered via `renderCommentWithMentions`. Composer hidden for read-only viewers (matches RLS)
- **Read-only mode** when the viewer is neither creator nor assignee: all inputs disabled, no attachment mutations, no comment composer, no delete
- ⚠️ Prop contract `{ task, onClose, onDelete, onChanged }` is shared with [Calendar/index.tsx](../src/components/Calendar/index.tsx) — keep it stable
- **Uses hooks:** useTaskComments, useAuth
- **Uses components:** AttachmentList, MarkdownView, MentionPicker, mentions

### components/AttachmentList.tsx
- Drag-drop zone, signed-URL image thumbnails, per-file progress + delete (RLS-enforced via the passed `canDelete(attachment)` predicate), 25 MB + 10-file client caps
- Requires a persisted `taskId` — create flow adds attachments from the detail drawer after save

### components/MentionPicker.tsx, components/mentions.ts
- Textarea with `@` detection popover + arrow-key navigation. Mentions are stored inline as `@[username](uuid)` tokens
- `renderCommentWithMentions(comment)` returns a `{ type: 'text' | 'mention', value, userId? }[]` sequence for the renderer

---

## Notes
- Acknowledge semantics: opening `/tasks` clears the current user's badge via `acknowledgeAllTasks` + `dispatchTasksRead` (once per mount)
- Private tasks skip the assignee picker; the creator becomes the sole pre-acknowledged assignee
- The calendar's `TaskPill` flips completed on/off, same as the list checkbox
- Comment mention notifications are deferred until a notifications table exists (tracked in `docs/tasks-redesign-plan.md` §11)
- Migration `20260706120000_simplify_tasks.sql` (data: `in_progress` → `todo`; drops `reminder_offsets`, `priority`, `task_reminder_sends`; broadens SELECT policies) must be applied by a human — after applying, regenerate types with `npm run db:types`
- Migrations `20260720120000_tasks_mobile_compat.sql` (profiles mirror + `is_admin()`, task tables → auth-id space, `status` → `completed`, `due_date` → `deadline`, RLS on `auth.uid()`) and `20260720130000_task_assignees_mobile_compat.sql` (`user_id` → `assignee_id`, composite PK, `create_task_with_assignees` RPC) must be applied by a human — the frontend on this branch **requires** both. The colleague's standalone mobile app points at this same schema; its own migrations in `todoMigrations/` must **never** be run against this DB
