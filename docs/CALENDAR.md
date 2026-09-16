# Module: Calendar

**Path:** `src/components/Calendar/`

## Overview

Personal and shared scheduling with four views (Day / Week / Month / Agenda), RSVP responses at both the series and single-occurrence scope, RFC-5545 RRULE recurrence with per-occurrence exceptions, reminder toasts delivered via Supabase realtime, a team busy-hours overlay, a per-user "Show tasks" toggle that merges task due-dates into the calendar, and a global header badge for unacknowledged events.

---

## Data Layer

Five tables:

- `calendar_events` — master record. Recurrence rule stored on the event as an RFC-5545 `RRULE` string in `recurrence`; reminder offsets (minutes before start) in `reminder_offsets int[]`; `busy` flag controls whether the event blocks team-calendar slots. Event types: `meeting`, `personal`, `deadline`, `reminder`. `is_private` events are only visible to the creator.
- `calendar_event_participants` — junction rows with `response` (`pending` | `accepted` | `declined`) and `acknowledged_at`. This is the **series-scope** RSVP.
- `calendar_event_exceptions` — per-occurrence overrides keyed by `(event_id, original_start_at)`. Stores `override_start_at`, `override_end_at`, `override_title`, or `is_cancelled`.
- `calendar_occurrence_responses` — per-occurrence RSVP keyed by `(event_id, user_id, original_start_at)`. If present, shadows the series-scope response for that single occurrence.
- `calendar_notifications` — reminder dispatcher writes one row per user per occurrence per offset. Clients subscribe to INSERTs to surface toasts.

Non-recurring queries use an overlap filter (`start_at < to AND end_at > from`). Recurring masters are fetched with an unbounded lower bound and the client expands occurrences into the visible window.

### services/calendarService.ts
- `fetchEventsInRange(userId, fromIso, toIso)` — returns hydrated events (creator + participants + exceptions + current user's occurrence responses). Runs four separate queries (created non-recurring, participant non-recurring, created recurring, participant recurring) and deduplicates.
- `fetchProjectOptions()` — project list for the project linkage field
- `createEvent(input, userId)` — inserts the event; inserts a single self-participant for private events, otherwise inserts one row per `participant_ids` member with the creator auto-accepted
- `updateEvent(eventId, updates, eventTitle?)` — patches any editable field; logs `calendar_event.update` with `changed_fields`
- `updateEventWithParticipants(eventId, input, previous)` — saves the edit form. Writes only the columns that differ from `previous` ([buildEventUpdate](../src/components/Calendar/utils/eventEdit.ts); never `start_at` / `end_at` / `recurrence` for a recurring series) plus `updated_at` (no trigger maintains it), then reconciles participant rows ([planParticipantChanges](../src/components/Calendar/utils/eventEdit.ts)): removed invitees' rows are deleted, new invitees get `pending` rows, unchanged rows keep their RSVP, the creator's own row is never deleted, and a private event ends with only the creator's accepted row. One `calendar_event.update` log for the whole edit; `changed_fields` includes `participants` when rows were added or removed, with `participants_added` / `participants_removed` counts. No transaction spans the writes — on a partial failure what succeeded is logged and the error is rethrown
- `deleteEvent(eventId, eventTitle?)` — removes the event (FK cascade removes participants, exceptions, occurrence responses)
- `respondToEvent(participantId, response, eventId?, eventTitle?)` — **series-scope** RSVP; logs with `scope: 'series'`
- `respondToOccurrence(eventId, userId, originalStartAtIso, response, eventTitle?)` — **occurrence-scope** RSVP upsert; logs with `scope: 'occurrence'`
- `createException(eventId, originalStartAt, override, eventTitle?)` — per-occurrence override (reschedule, rename, or cancel a single instance); logs `calendar_event.exception_create`. An **upsert** on `(event_id, original_start_at)`: the table is unique on that pair, so a plain insert used to fail when cancelling an occurrence that already had an exception
- `deleteException(exceptionId, eventId, eventTitle?)` — revert a single occurrence to its RRULE-derived defaults
- `fetchPendingCount(userId, fromIso, toIso)` — counts `pending` occurrences starting in the window via `countPendingOccurrences`; used by the header badge (`useCalendarNotifications`)
- `getUnacknowledgedEventCount(userId)` — count of participant rows where `acknowledged_at IS NULL`, used by the global badge
- `acknowledgeAllEvents(userId)` — bulk-clears unread badges; logs only if at least one row was affected
- **Depends on:** supabase client, activityLog, `expandEvents`
- **Logs:** `calendar_event.create` (medium), `calendar_event.update` (medium), `calendar_event.respond` (low), `calendar_event.delete` (high), `calendar_event.exception_create` (medium/high when cancelling), `calendar_event.exception_delete` (medium), `calendar_event.acknowledge_all` (low)

### services/busyBlocksService.ts
- `fetchBusyBlocks(userIds, fromIso, toIso)` — RPC into `get_busy_blocks`. Returns `{ user_id, start_at, end_at }[]` for the team-calendars overlay; the RPC hides private events and de-duplicates overlapping occurrences server-side

---

## Hooks

### hooks/useCalendarPreferences.ts
- `useCalendarPreferences()` — owns the month/week/day anchor plus user-scoped preferences persisted to `localStorage` under `calendar.prefs.${userId}`: `view`, `activeTypes`, `activeProjectId`, `activeParticipantIds`, `enabledTeams`, `showTasks`
- Navigation helpers: `goPrev` / `goNext` step by view unit (day/week/month), `goToday`, `jumpTo(date)`
- Toggle helpers: `toggleType`, `toggleTeam`, `toggleShowTasks`, `setActiveProjectId`, `setActiveParticipantIds`, `setView`

### hooks/useEventsInRange.ts
- `useEventsInRange({ fromIso, toIso, activeTypes, activeProjectId, activeParticipantIds, search })` — fetches raw events for the visible window and memoises the filtered + expanded `occurrences`
- Tracks the latest request id so stale responses from older ranges do not overwrite newer state
- Subscribes via Supabase realtime to four channels scoped by user: `calendar_events`, `calendar_event_participants`, `calendar_event_exceptions`, `calendar_occurrence_responses` (filtered to the current user). Any change triggers a refetch
- Channel names carry a per-instance `useId()` suffix. `supabase.channel(name)` returns the existing channel for a taken name and a channel subscribes only once, so the CalendarPage's two instances (grid + sidebar) would otherwise collide
- Omitted filters default to a module-level empty array, so an unfiltered caller does not re-expand every recurrence on each render
- **Returns:** `rawEvents`, `occurrences`, `loading`, `error`, `refresh`

### hooks/useTasksInRange.ts
- `useTasksInRange({ fromIso, toIso, enabled, activeProjectId, activeParticipantIds, search })` — fetches tasks with a `due_date` in the window via `tasksService.fetchTasksInRange`, then memoises the expansion via [expandTasks](../src/components/Calendar/utils/expandTasks.ts)
- Gated by `enabled` — nothing fetches or subscribes when the "Show tasks" toggle is off
- Subscribes to `tasks` and `task_assignees` realtime channels
- **Returns:** `rawTasks`, `taskOccurrences`, `loading`, `error`, `refresh`

### hooks/useCalendarReminderToasts.ts
- `useCalendarReminderToasts()` — subscribes to `INSERT`s on `calendar_notifications` filtered to the current user and surfaces each as a `ToastContext` notification formatted as `"{title} · {offset} · {HH:MM}"`
- **Mounted in:** [CalendarPage](../src/components/Calendar/index.tsx)

### hooks/useCalendarNotifications.ts
- `useCalendarNotifications()` — powers the global red badge on the calendar icon in [Layout.tsx](../src/components/Common/Layout.tsx)
- Every 20 s counts the occurrences awaiting the user's response in `pendingWindow()` (now → `PENDING_WINDOW_DAYS` = 30) through `fetchPendingCount`; listens for `calendar:marked-read` window events to refresh on demand
- Exports `dispatchCalendarRead()`, which the CalendarPage calls after acknowledgement, after any change made in the event detail modal, and after a quick accept / decline in the sidebar, so the badge recounts immediately
- **Mounted in:** [Layout.tsx](../src/components/Common/Layout.tsx) (global)

---

## Utils

- `utils/recurrence.ts` — `expandEvents(events, windowStart, windowEnd, currentUserId)` parses `RRULE` strings via the `rrule` library, iterates through occurrences inside the window, applies any matching exception override, and resolves the current user's `myResponse` (occurrence override → series master → **`accepted` if the user created the event** → `pending`) plus `myParticipantId` for series-scope actions. The creator of a public event has no participant row, and before that rule their own meetings counted as invitations in both the badge and the sidebar. `currentUserId` and `created_by` are both `public.users` ids. Each result is an `ExpandedOccurrence` with a stable `originalStartIso` key. Tested in `recurrence.test.ts`
- `utils/recurrencePresets.ts` — maps the modal's recurrence UI (preset + end kind + custom interval/freq/byweekday) to an `RRULE` string via `rrule`. Presets: `none | daily | weekly | monthly | yearly | custom`; end kinds: `never | on | after`. `describeRecurrence(rule, t, locale)` turns a stored rule back into one line of text for the edit form ("Weekly (Mon) · Ends: After 10 occurrence(s)") from the picker's own i18n labels — not rrule's `toText()`, which is English-only. Tested in `recurrencePresets.test.ts`
- `utils/eventEdit.ts` — the pure half of editing: `buildEventUpdate(previous, input)` (changed columns only; series timing excluded) and `planParticipantChanges(existing, creatorId, { isPrivate, participantIds })` → `{ removeRowIds, addUserIds, creatorRow }`, plus `hasParticipantChanges`. Tested in `eventEdit.test.ts`
- `utils/monthLayout.ts` — `computeMonthLayout()` packs multi-day event segments into 7-column week rows with stable vertical slots and `continuesLeft/continuesRight` flags, mirroring Google/Outlook month layout
- `utils/expandTasks.ts` — turns each `Task` with a `due_date` in the window into a `TaskOccurrence { occurrenceKey, task, due_at, isOverdue, isDone }`. Date-only tasks are anchored at 23:59 local so they sort after timed items for the day
- `utils/pendingCount.ts` — `PENDING_WINDOW_DAYS` (30) and `pendingWindow(now)`, the one definition of "awaiting my response"; `selectPendingOccurrences(occurrences, from, to)` (resolved `pending`, starting inside the window, sorted) and `countPendingOccurrences(events, userId, from, to)` built on it. The badge and the sidebar's AwaitingResponse both go through these. Tested in `pendingCount.test.ts`
- `utils/teamColors.ts` — stable color-per-user-id via simple hash over the user id
- `utils/relativeLabel.ts` — shared "in 2 h / tomorrow / Fri 14:00" formatter

---

## Views

### index.tsx (CalendarPage)
- Header, nav row (prev/next/today + view switcher + "Show tasks" toggle), [CalendarFilterBar](../src/components/Calendar/components/CalendarFilterBar.tsx), main grid, sidebar
- Delegates to Day/Week/Month/Agenda view components based on `prefs.view`
- On mount: `acknowledgeAllEvents` → `dispatchCalendarRead()` (clears the header badge), then fetches projects + users in parallel
- Fetches team busy-blocks via `fetchBusyBlocks` whenever `prefs.enabledTeams` changes
- Hosts all modals: `NewEventModal`, `EventDetailModal`, `DayEventsModal`, and the [TaskDetail](../src/components/Tasks/TaskDetail.tsx) drawer (re-used from the Tasks module) for task pills
- Runs **two** `useEventsInRange` instances: the grid's (view range + filter bar) and the sidebar's (today → `PENDING_WINDOW_DAYS` + 1 day, fixed at mount, unfiltered). AwaitingResponse and NextUp read the sidebar's, so they match the header badge whatever month is shown or filter is set. Mutations refresh both
- The clicked occurrence is kept as a snapshot and re-resolved from the fresh occurrences after every refresh (event id + `originalStartIso`; event id alone for a one-off event, whose start moves when edited), the same way `resolvedSelectedTask` works. The stored event behind it is passed as `sourceEvent`, so the edit form never loads an occurrence's title override as the series title
- **Uses hooks:** `useAuth`, `useCalendarPreferences`, `useEventsInRange`, `useTasksInRange`, `useCalendarReminderToasts`
- **Uses components:** MonthView, DayView, WeekView, AgendaView, ViewSwitcher, CalendarFilterBar, GridSkeleton, sidebar/{MiniMonth, NextUp, AwaitingResponse, TeamCalendars}

### MonthView.tsx
- 6-row × 7-column month grid using `computeMonthLayout` for multi-day event segments; each cell shows up to 3 event slots + up to 3 task slots with a combined "+N more" affordance that opens `DayEventsModal`
- Empty-cell click → creates a 09:00–10:00 event on that date via the parent's `handleMonthCellClick`
- Day-of-week headers translated via `t('calendar.day_names.*')`

### views/DayView.tsx
- Single-day vertical timeline anchored on `anchor`. Hours rendered via the shared `TimelineColumn` + [timeSlots](../src/components/Calendar/views/_shared/timeSlots.ts) utilities
- Tasks for the day render in a dedicated "Tasks" lane above the hour grid (deadlines are not time-boxed blocks)
- `onSlotSelect` via [useClickToCreate](../src/components/Calendar/views/_shared/useClickToCreate.ts) — drag-select a range to open `NewEventModal` pre-filled with the selection

### views/WeekView.tsx
- 7-day timeline, same layout primitives as DayView. Overlapping events flow into side-by-side columns via [overlappingLayout](../src/components/Calendar/views/_shared/overlappingLayout.ts)

### views/AgendaView.tsx
- Chronological list grouped by day for the next 30 days from `anchor`. Events and task occurrences are interleaved per day and sorted by start/due time

### views/_shared/

Shared timeline primitives for DayView and WeekView. Both views render the same hour grid, so
the geometry lives here once.

- **TimelineColumn.tsx** — one day's hour grid plus its absolutely-positioned event cards. Below a
  40 px card height it drops the secondary time-range line, on the grounds that a full title beats a
  clipped title over a clipped `"11:00 A…"`
- **NowIndicator.tsx** — the current-time line; renders nothing when `now` falls outside the day it
  was given, so the week grid only draws it on today's column
- **timeSlots.ts** — the shared constants and helpers both of the above key off (`HOUR_HEIGHT`,
  `DAY_HOURS`, `VISIBLE_START_MIN` / `VISIBLE_END_MIN`, `minutesFromDayStart`, `startOfDay`).
  Change a layout constant here, not in a view
- **overlappingLayout.ts** — flows overlapping events into side-by-side columns
- **useClickToCreate.ts** — drag-select a time range to open `NewEventModal` pre-filled

### Modals

#### NewEventModal.tsx
- Form for creating an event (title, description, location, start/end, type, private toggle, project link, participants picker, recurrence picker, reminder chip list)
- Reminder presets: `[0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]` minutes (at time → 1 week before)
- **Create mode** calls the parent's `onCreate(input)`, which delegates to `createEvent`
- **Edit mode** (`event` + `onSave`): prefilled from the stored event, titled "Edit event", saves with "Save Changes". The form resets only when it opens or is pointed at another event — not when a realtime refresh hands it a new object for the same row
- For a **recurring series** the date, times and repeat rule are read-only: the rule is shown as text (`describeRecurrence`) with the note `calendar.modal.series_timing_readonly`. Exceptions and per-occurrence RSVPs are keyed by each occurrence's rule-derived start, so moving the series would orphan them. A one-off event can change its date and time and gain a rule

#### EventDetailModal.tsx
- Event details with RSVP buttons (accept / decline). Recurring-event users can scope the response to this single occurrence (via `respondToOccurrence`) or the whole series (via `respondToEvent`)
- Creator sees **Edit**, and delete: "Delete" on a one-off event; "Delete this occurrence" (a cancelling `createException`) and "Delete series" on a recurring one
- Edit opens `NewEventModal` in edit mode in place of the detail (the detail is hidden, not closed); saving calls `updateEventWithParticipants`, awaits `onChanged()`, and the detail comes back showing the re-resolved occurrence. A small effect keeps the page's scroll lock on across that swap, since the two Modals' own lock effects would otherwise race
- Failed deletes and RSVPs show a toast (`calendar.detail.delete_failed` / `respond_failed`); a failed edit shows its error inline in the form, which stays open
- Inline [ConfirmDialog](../src/components/ui/ConfirmDialog.tsx) (variant `danger`) for destructive actions

#### DayEventsModal.tsx
- Modal listing every event and task occurrence on a specific day; clicking an event opens `EventDetailModal`, clicking a task opens the `TaskDetail` drawer

---

## Components

- `components/ViewSwitcher.tsx` — SegmentedControl for Day/Week/Month/Agenda
- `components/CalendarFilterBar.tsx` — event-type chips, project select, participant picker, search input. Types / project / participants also scope the tasks overlay
- `components/TaskPill.tsx` — shared pill used by Week/Day/Agenda/NextUp/DayEventsModal. Square/CheckSquare icon toggles `todo ↔ done` via `updateTaskStatus`; red left accent for overdue, strikethrough for done, paperclip + comment-count indicators
- `components/ParticipantPicker.tsx` — searchable multi-select of users, shared with [TaskModal](../src/components/Tasks/TaskModal.tsx)
- `components/GridSkeleton.tsx` — 42-cell shimmering skeleton rendered while the first fetch is in flight

### Sidebar widgets (`components/sidebar/`)
- `MiniMonth.tsx` — compact month navigator with a busy-day dot indicator; clicking a date drives the parent anchor
- `NextUp.tsx` — upcoming events (and tasks due in the next 24 h, when the toggle is on) mixed in one list. Events come from the sidebar window, not the grid; tasks still come from the grid's range and filters
- `AwaitingResponse.tsx` — pending RSVPs in `pendingWindow()` with inline accept / decline buttons that call `respondToOccurrence`. Lists the first 10; the header count is the full total, so it equals the header badge
- `TeamCalendars.tsx` — toggle per-user "overlay my team's busy blocks onto my calendar". Color dot mirrors [teamColors.ts](../src/components/Calendar/utils/teamColors.ts). Total busy-hours summary is rendered in a separate card below when at least one team is enabled

---

## Tasks overlay

A per-user "Show tasks" toolbar toggle (next to `ViewSwitcher`) merges task due-dates into the calendar as read-only `TaskOccurrence` pills. Data path runs in parallel to events — no schema unification.

- **Click target:** the pill title opens the `TaskDetail` drawer (not the event modal); the checkbox toggles status
- **Filtering:** the `CalendarFilterBar` project + participant + search fields apply to tasks too; event-type chips do not
- **View-specific rendering:**
  - **MonthView** — per-day task pills layered below event segments (18 px slot vs. 22 px event slot, up to 3 tasks); task overflow feeds the "+N more" count
  - **WeekView / DayView** — a dedicated "Tasks" lane above the hour grid
  - **AgendaView** — interleaved with events per-day, sorted by `due_at`
  - **NextUp sidebar** — includes tasks due within the next 24 h when the toggle is on
  - **DayEventsModal** — tasks listed above events with a divider

---

## Notes
- Acknowledgement vs. response are independent: `acknowledged_at` clears the badge; `response` is the RSVP. Opening `/calendar` acknowledges everything but does not auto-RSVP
- Series-scope vs. occurrence-scope RSVPs are resolved in [recurrence.ts#resolveResponse](../src/components/Calendar/utils/recurrence.ts): an occurrence override wins over the series master
- The 3-month range fetch on Month view is intentional — it covers the visible month plus the lead-in/lead-out days from neighbouring months that the grid renders. Day/Week/Agenda use tighter windows
- All native `confirm()` calls have been replaced with `ConfirmDialog` per CLAUDE.md
- Realtime subscriptions are per-user-id channels; a single user with multiple tabs will still get one channel per tab (Supabase-JS scopes by client instance)
