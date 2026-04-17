# Module: Tasks

**Path:** `src/components/Tasks/`

## Overview

Personal task tracking with three categories (assigned to me, created by me, private), priority/status enums, due dates, comments thread per task, and a global header badge for unacknowledged assignments.

---

## Data Layer

Three tables: `tasks`, `task_assignees` (junction with `acknowledged_at`), `task_comments`. Priority: `low` | `normal` | `high` | `urgent`. Status: `todo` | `in_progress` | `done` (and `completed_at` when status flips to `done`). Private tasks have a single self-row in `task_assignees` auto-acknowledged at creation.

### services/tasksService.ts
- `fetchTaskUsers()` — list of all users for the assignee picker
- `fetchMyTasks(userId)` — tasks created by me OR assigned to me, deduplicated by ID, hydrated with creator + assignees
- `createTask(input, userId)` — inserts a task; for private tasks creates a single self-assignee with `acknowledged_at = now()`; otherwise inserts assignee rows for each `assignee_ids` entry
- `updateTaskStatus(taskId, status)` — patches status + `updated_at`; sets `completed_at` when status becomes `done`, clears it otherwise
- `deleteTask(taskId)` — removes the task (cascade removes assignees and comments)
- `getUnacknowledgedTaskCount(userId)` — count of `task_assignees` rows where `acknowledged_at IS NULL`, used by the global badge
- `acknowledgeAllTasks(userId)` — bulk-clears badges by setting `acknowledged_at = now()`
- `fetchTaskComments(taskId)` — comments for a task, hydrated with user data
- `createTaskComment(taskId, userId, comment)` — inserts a comment row; trims whitespace and silently no-ops on empty
- `deleteTaskComment(commentId)` — removes a comment
- `hydrateTaskRelations(tasks)` — internal helper that loads creator + assignees user data
- **Depends on:** supabase client
- **Logs:** none — task and comment mutations are intentionally not logged to keep the audit trail focused on financial/business actions

---

## Hooks

### hooks/useTasks.ts
- `useTasks()` — owns the full task list and partitions it into three memoized lists (assigned, created, privateTasks) based on the current user
- On mount/user change, calls `acknowledgeAllTasks` then dispatches `tasks:marked-read` so the badge clears immediately when the user opens the page
- **Calls:** tasksService.ts
- **Returns:** tasks, assigned, created, privateTasks, loading, create, toggleStatus, remove, refresh

### hooks/useTaskComments.ts
- `useTaskComments(taskId)` — owns the comments list, draft text, send/delete actions for a single task
- Re-fetches whenever `taskId` changes; clears state when `taskId` is `null`
- **Calls:** tasksService.ts
- **Returns:** comments, loading, draft, setDraft, sending, send, remove, refresh

### hooks/useTasksNotifications.ts
- `useTasksNotifications()` — powers the global red badge on the tasks icon in [Layout.tsx](../src/components/Common/Layout.tsx)
- Polls `getUnacknowledgedTaskCount` every 20 s
- Listens for `tasks:marked-read` window events to refresh on demand
- Exports `dispatchTasksRead()` helper used by `useTasks`
- **Calls:** tasksService.getUnacknowledgedTaskCount
- **Returns:** unreadCount, refresh
- **Mounted in:** [Layout.tsx](../src/components/Common/Layout.tsx) (global)

---

## Views

### index.tsx (TasksPage)
- Header + 3-tab navigation (assigned / created / private), task list, and "New task" button
- Hosts the inline `ConfirmDialog` for task deletion (pending-item pattern, no native `confirm()`)
- **Uses hooks:** useTasks
- **Uses components:** TaskCard, NewTaskModal, TaskDetailModal
- **Uses Ui:** ConfirmDialog

### TaskCard.tsx
- Compact task row: priority-colored left border, status checkbox, title with optional private lock icon, description, due date, priority + status labels, and assignee avatars (up to 3 with "+N" overflow)
- Delete button only visible to the creator

### NewTaskModal.tsx
- Form for creating a task (title, description, due date/time, priority, private toggle, assignees picker)
- Calls the hook's `create(input)` callback rather than the service directly

### TaskDetailModal.tsx
- Read-only task details + assignee chips + threaded comments
- Comments section: list with mine-on-right alignment, composer (Ctrl/Cmd+Enter to send), per-comment delete via inline `ConfirmDialog` for own comments only
- **Uses hooks:** useTaskComments
- **Uses Ui:** ConfirmDialog

---

## Notes
- "Acknowledge" semantics: opening `/tasks` clears the user's unread badge by acknowledging all of their assignee rows. The task itself remains in their list until completed or deleted
- Private tasks bypass the assignee picker entirely; the creator becomes the sole pre-acknowledged assignee
- Status toggle on a task card flips between `todo` and `done` only — intermediate `in_progress` is set elsewhere (currently via task edit, not in the UI surface today)
