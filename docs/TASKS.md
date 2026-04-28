# Module: Tasks

**Path:** `src/components/Tasks/`

## Overview

Full-lifecycle task tracking with three tabs (Assigned to me / Created by me / Private), a 3-value status pill (todo / in progress / done), project linkage, configurable reminders, drag-drop file attachments, markdown descriptions, @mention comments, and an activity-log tab. Task due-dates can additionally be surfaced as pill occurrences on the Calendar page via a per-user "Show tasks" toggle.

---

## Data Layer

Four tables:
- `tasks` — carries `project_id`, `reminder_offsets int[]`, `description_format ('markdown'|'plain')`; status is `todo` | `in_progress` | `done` (no `cancelled`). `completed_at` flips when status becomes `done`
- `task_assignees` — junction with `acknowledged_at` (badge clears on visit)
- `task_comments` — thread per task; `user_id` FKs to `public.users`; bodies may embed `@[username](uuid)` mention tokens
- `task_attachments` — storage metadata for files uploaded to the private `task-attachments` Storage bucket (25 MB/file, 10/task); RLS restricts read/write to the task's assignees and creator

A `task_reminder_sends` idempotency table backs the future `dispatch-task-reminders` Edge Function (not yet wired to UI).

Every mutation is logged through `logActivity()` with `entity='task'` and action `task.<verb>` (create / update / status_change / delete / assign / unassign / comment / attachment_add / attachment_remove).

### services/tasksService.ts
- `fetchTaskUsers()` — user list for pickers
- `fetchProjectOptions()` — project list for the project linkage field
- `fetchMyTasks(userId)` — created + assigned tasks, deduplicated, hydrated with creator, assignees, attachments, comment count
- `fetchTasksInRange(userId, fromIso, toIso)` — same shape, restricted to tasks with `due_date` inside the window; used by the Calendar overlay
- `createTask(input, userId, userRole)` — inserts a task + assignee rows (or a single self-row for private); logs `task.create`
- `updateTask(taskId, updates, userId, userRole, title?)` — patches a task; logs `task.update` with `changed_fields`
- `updateTaskStatus(taskId, status, userId?, userRole?, title?)` — status-only patch; writes `completed_at`; logs `task.status_change`
- `deleteTask(taskId, userId?, userRole?, title?)` — cascade remove; logs `task.delete` (high severity)
- `setAssignees(taskId, ids, userId, userRole)` — diff-based add/remove; logs `task.assign` / `task.unassign`
- `fetchTaskComments(taskId)` / `createTaskComment` / `deleteTaskComment` — thread CRUD; `createTaskComment` logs `task.comment`
- `listTaskAttachments` / `uploadTaskAttachment` / `deleteTaskAttachment` / `getAttachmentSignedUrl` — attachment CRUD with 25 MB + 10-per-task enforcement; logs `task.attachment_add` / `task.attachment_remove`. Bucket constant: `TASK_ATTACHMENTS_BUCKET = 'task-attachments'`
- `fetchTaskActivity(taskId)` — filtered view of `activity_logs` where `entity='task' AND entity_id=<id>`, hydrated with username/role; returns `TaskActivityEntry[]` used by the Detail drawer's Activity tab
- `getUnacknowledgedTaskCount(userId)` / `acknowledgeAllTasks(userId)` — global badge helpers
- **Depends on:** supabase client, activityLog
- **Logs:** every mutation listed above

---

## Hooks

### hooks/useTasks.ts
- `useTasks()` — loads `fetchMyTasks(user.id)` on mount; also calls `acknowledgeAllTasks` + `dispatchTasksRead` once per session so opening `/tasks` clears the badge
- Exposes `tasks`, `loading`, and mutation callbacks: `create`, `update`, `setStatus`, `toggleStatus` (`todo ↔ done`), `remove`, `refresh`. All mutations call `load()` after success so the list is always source-of-truth
- Filter / sort / group / search state is **not** in this hook — it lives in [index.tsx](../src/components/Tasks/index.tsx) and is persisted per-user to `localStorage` under `tasks.filters.${userId}`

### hooks/useTasksRealtime.ts
- `useTasksRealtime(userId, onChange)` — subscribes to four Supabase realtime channels scoped to the user: `tasks`, `task_assignees` (filtered to the current user), `task_comments`, `task_attachments`. Any change fires `onChange` to trigger a refetch
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
- Header with 3 tab buttons (Assigned / Created / Private) showing live counts
- Toolbar: search, filter popover (status chips, project select, assignee checklist), sort select (`due | created | title`), group select (`none | project | status | due`), "Show completed" toggle, "New task" button
- Filters bag persisted per-user to `localStorage`; reloaded on user change
- Groups roll up visible tasks by the chosen grouping key; "none" collapses to a single pseudo-group
- When `rows.length > 100` the list is virtualized via [`@tanstack/react-virtual`](https://www.npmjs.com/package/@tanstack/react-virtual) with mixed header (36 px) / row (68 px) heights; below the threshold it renders as a plain flow
- Selected task renders in `TaskDetail` drawer; new task flow opens `TaskModal`; delete flows through a shared `ConfirmDialog`
- **Uses hooks:** useTasks, useTasksRealtime, useAuth
- **Uses components:** TaskRow, TaskModal, TaskDetail
- **Uses UI:** ConfirmDialog, ToggleSwitch

### TaskRow.tsx
- Compact row: red left accent when overdue, status pill (click-cycles `todo → in_progress → done → todo`), title, project tag, relative due label, attachment icon + count, unread-comment dot, stacked avatars (3 + "+N") via [AvatarStack](../src/components/ui/AvatarStack.tsx), hover overflow menu

### TaskModal.tsx
- Create + edit modal. Fields: title, status, project ([SearchableSelect](../src/components/ui/SearchableSelect.tsx)), due date + time, reminders (chip list with presets `[5, 15, 60, 1440, 2880]` min + custom input), private toggle, assignees ([ParticipantPicker](../src/components/Calendar/components/ParticipantPicker.tsx), reused from Calendar), attachments ([AttachmentList](../src/components/Tasks/components/AttachmentList.tsx), edit mode only), description (markdown textarea with Preview toggle)
- Ctrl+Enter submits; Esc cancels with dirty-state confirm
- **Uses components:** AttachmentList, MarkdownView, ParticipantPicker

### TaskDetail.tsx
- Slide-from-right drawer via `createPortal`. Inline-editable fields auto-save on change
- Two tabs: **Comments** (default, [MentionPicker](../src/components/Tasks/components/MentionPicker.tsx) composer with `@` autocomplete; mention tokens rendered via `renderCommentWithMentions`) and **Activity** (last 3 entries with "Show all", pulled from `fetchTaskActivity`)
- Delete button bottom-left with `ConfirmDialog`
- **Uses hooks:** useTaskComments, useAuth
- **Uses components:** AttachmentList, MarkdownView, MentionPicker, mentions

### components/AttachmentList.tsx
- Drag-drop zone, signed-URL image thumbnails, per-file progress + delete (RLS-enforced via the passed `canDelete(attachment)` predicate), 25 MB + 10-file client caps
- Requires a persisted `taskId` — in create mode the parent shows a hint and surfaces the attachment UI after save

### components/MentionPicker.tsx, components/mentions.ts
- Textarea with `@` detection popover + arrow-key navigation. Mentions are stored inline as `@[username](uuid)` tokens
- `renderCommentWithMentions(comment)` returns a `{ type: 'text' | 'mention', value, userId? }[]` sequence for the renderer

---

## Notes
- Acknowledge semantics: opening `/tasks` clears the current user's badge via `acknowledgeAllTasks` + `dispatchTasksRead` (once per mount)
- Private tasks skip the assignee picker; the creator becomes the sole pre-acknowledged assignee
- Status pill cycles `todo → in_progress → done → todo`. The status-change on the calendar's `TaskPill` flips only `todo ↔ done` (no tri-state click there)
- Attachments require a persisted task id — `TaskModal` shows a hint in create mode and surfaces the attachment UI after save
- Comment mention notifications are deferred until a notifications table exists (tracked in `docs/tasks-redesign-plan.md` §11)
- The `task_reminder_sends` table exists for a future dispatcher Edge Function; it is not currently written to from client code
