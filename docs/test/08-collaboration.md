# Collaboration

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

_Preconditions: any authenticated user; at least one other active user exists so group chats, participants and assignees can be picked. Chat and Calendar depend on Supabase Realtime being reachable — if the websocket is blocked, the features fall back to 3 s / 20 s polling._

## Calendar

_Route: `/calendar`. Global red badge sits on the calendar icon in the Layout header and reflects `calendar_event_participants.acknowledged_at IS NULL` events._

### Month view & navigation

```
open /calendar → current month grid renders (6 rows × 7 cols), today highlighted            (+)
day-of-week headers are localized to active language (HR → "Pon, Uto, ..." ; EN → "Mon, Tue, ...")  (+)
click "Next" → anchor advances one month, events re-fetch for new 3-month window            (+)
click "Prev" → anchor moves back one month                                                  (+)
click "Today" → grid jumps back to current month                                            (+)
sidebar shows "Today's events" and "Upcoming" (next 5) sections                             (+)
badge on header calendar icon clears on first visit (acknowledge_all runs on mount)         (+)
```

### Create event (NewEventModal)

_All fields default to sensible values: today's date, 09:00→10:00, type = meeting._

```
create event with all fields filled (title, description, location, participants)           (+)
create event with title empty → Create button stays disabled                                (+)
create event with date cleared → Create button stays disabled                               (+)
create event with whitespace-only title → Create button stays disabled (title.trim() check) (+)
pick each event type in turn (meeting / personal / deadline / reminder) → colored pill updates   (+)
toggle "Private" → participants picker disappears; on save event has a single self-participant (+)
select 0 participants on a non-private event → saves with only creator auto-accepted        (+)
select multiple participants → each gets a row with response='pending'                      (+)
set end_time earlier than start_time → form still saves (no client-side guard; confirm DB accepts) (+)
cancel → modal closes, no event created, list unchanged                                     (+)
close via X / Esc / backdrop → same as cancel                                               (+)
```

### Day detail & "+N more" overflow

```
day with ≤3 events → all render inline in the cell                                          (+)
day with 4+ events → shows first 3 plus "+N more" affordance                                (+)
click "+N more" → DayEventsModal opens listing every event for that day                     (+)
click an event inside DayEventsModal → EventDetailModal opens on top                        (+)
```

### Event detail & RSVP (EventDetailModal)

_A participant who is NOT the creator sees Accept / Decline RSVP buttons._

```
participant clicks Accept → response stored as 'accepted', badge color updates              ( )
participant clicks Decline → response stored as 'declined'                                  ( )
participant re-opens event and changes response Accepted → Declined → response persists     ( )
creator opens their own event → RSVP buttons not shown; Delete button shown instead         ( )
creator clicks Delete → ConfirmDialog (danger variant) appears, not native confirm()        ( )
confirm delete → event removed, cascade removes participants, toast confirms                ( )
cancel delete → event still present                                                         ( )
open a private event as someone other than the creator → forbidden / not visible in list    ( )
```

### Global unread badge (cross-screen)

```
user A creates an event assigning user B → within 20 s user B's header badge increments     ( )
user B opens /calendar → badge clears immediately (acknowledgeAllEvents + dispatchCalendarRead) ( )
user B's acknowledgement does NOT auto-RSVP (response still 'pending' in event detail)      ( )
user A deletes the event before B opens /calendar → B's badge decrements on next 20 s poll  ( )
```

---

## Chat

_Route: `/chat`. Global red badge sits on the chat icon in Layout. Two distinct Realtime channels are used: `chat-messages-realtime` (thread updates, mounted only on /chat) and `chat-notifications-realtime` (global badge, mounted via Layout with filter sender_id ≠ self)._

### Start a new conversation (NewConversationModal)

```
open modal → list of all users except self renders                                          ( )
type in search → list filters by username (case-insensitive substring)                      ( )
select 1 user → footer button shows "Start chat" with single-person icon                    ( )
select 2+ users → footer button shows "Create group" with group icon; group name input appears   ( )
select 0 users → Create/Start button is disabled                                            ( )
select then deselect a user via the chip "×" → chip removed, button label updates if count drops to 1 ( )
create 1:1 chat with user X twice → second attempt reuses the existing direct conversation (no duplicate)  ( )
create group with blank group name → saves with null name; list falls back to participant names ( )
create group with whitespace-only name → treated as blank (name stored null)                ( )
cancel during creation → modal closes, no conversation created                              ( )
```

### Conversation list & selection

```
conversation list sorts by most recent activity                                             ( )
each row shows last message preview, relative time ("now" if <60 s, else locale short)      ( )
unread count badge appears on rows with new incoming messages                               ( )
search box filters conversations by participant name                                        ( )
click a conversation → MessagePanel loads, unread badge on that row clears                  ( )
mobile width → tapping a conversation swaps to the message panel; back button returns       ( )
```

### Send a message (MessagePanel composer)

```
type text and press Send → bubble appears in thread with correct timestamp and "own" alignment ( )
send with Enter vs Shift+Enter → Enter sends, Shift+Enter inserts newline                   ( )
send empty / whitespace-only message → send button does nothing (no empty row inserted)     ( )
send a very long message (>2000 chars, Croatian diacritics čćšđž) → renders correctly       ( )
send consecutive messages within 60 s → bubbles group under a single timestamp cluster       ( )
send messages that cross midnight → "Today" / "Yesterday" / date separators render correctly ( )
```

### File attachments (chat-attachments bucket, 25 MB limit)

```
attach a small PDF (< 25 MB) → file chip renders in bubble with name + size + download link ( )
attach an image → preview thumbnail renders, click opens original                           ( )
attach a file exactly 25 MB → uploads successfully                                          ( )
attach a file > 25 MB → FILE_TOO_LARGE toast appears in active language, nothing sent       ( )
attach file with Croatian filename (šđčć.pdf) → name stored and displayed without mojibake  ( )
attach then remove before sending → attachment cleared, composer ready for next input       ( )
```

### Realtime badge & unread sync (two-session test)

```
sign in as user A in one browser, user B in another                                         ( )
A opens /chat and selects a conversation with B → marks as read, badge clears               ( )
B sends a message from another conversation → A's conversation-list unread badge increments instantly  ( )
B sends a message in the active conversation → A sees the bubble appear without reloading (realtime)   ( )
block the websocket (dev tools offline for ~5 s) → poll fallback (3 s active, 60 s global) still updates ( )
A switches to /projects then back to /chat → badge reflects accurate count from server       ( )
conversation.create logged to activity log (medium); message sends NOT logged               ( )
```

---

## Tasks

_Route: `/tasks`. Three tabs: Assigned to me, Created by me, Private. Global red badge for unacknowledged `task_assignees.acknowledged_at IS NULL` rows. Every mutation is activity-logged with `entity='task'` and action `task.<verb>`._

### Create task (TaskModal, create mode)

```
create task with title only → saves with status=todo, no due date, no assignees             ( )
create task with title empty → Create button disabled                                       ( )
create task with whitespace-only title → Create button disabled (title.trim() check)        ( )
fill title, status=in_progress, project, due date/time, 1 assignee, markdown description → saves  ( )
toggle Private → assignees picker hides; on save task has 1 self-assignee auto-acknowledged ( )
reminder chips: click each preset (5 / 15 / 60 / 1440 / 2880 min) → added to list, click again removes ( )
reminder custom entry: type "45" + Add → "45 min before" chip appears                       ( )
description tabs: switch to Preview → markdown renders (bold / list / code block); Edit → textarea back ( )
attachments section is hidden in create mode (hint: "Save the task to add attachments")     ( )
Ctrl+Enter in any field → submits the form                                                  ( )
Esc with clean form → closes; Esc with dirty form → ConfirmDialog ("Discard changes?")      ( )
activity_logs gains one row with action='task.create' and metadata.entity_name = title      ( )
```

### Toolbar, tabs, and rows

```
default tab is "Assigned to me"; counts in tab badges match list length                     ( )
"Created by me" tab → tasks where creator = self                                            ( )
"Private" tab → only private tasks created by self (lock icon on each row)                  ( )
search box (debounced 200 ms) matches title + description, case-insensitive                 ( )
filter dropdown: Status / Project / Assignees; clearing restores full list                  ( )
sort dropdown: Due date / Created / Title → list reorders immediately                       ( )
group-by toggle: None / Project / Status / Due date → sections render with counts           ( )
"Show completed" off → done rows hidden; on → reappear                                      ( )
filter/sort/group/search state survives a page reload (localStorage per user)               ( )
seed 150 tasks → virtualization kicks in (@tanstack/react-virtual); scrolling stays smooth  ( )
TaskRow left accent turns red when due_date < now AND status != done (overdue indicator)    ( )
TaskRow shows project tag, attachment icon+count (if any), unread-comment dot (if any)      ( )
avatars: 3 overlapping circles + "+N" chip when > 3 assignees                               ( )
status pill click cycles todo → in_progress → done → todo                                   ( )
```

### Task detail drawer (TaskDetail)

```
click a row → drawer slides in from the right (portal)                                      ( )
inline edit title → blur or Enter commits; activity_logs gains task.update row              ( )
change status segmented → auto-saves; row reflects immediately (optimistic)                 ( )
change project via SearchableSelect → saves; activity_logs row includes changed_fields      ( )
assignee picker (non-private only): add/remove → task.assign / task.unassign logged         ( )
description: Edit/Preview tabs mirror TaskModal; Preview renders markdown safely            ( )
attachments: drag-drop a ≤25 MB file → appears in list with signed-url image thumb          ( )
upload 11th file → rejected with "Maximum 10 attachments per task" toast                    ( )
upload a 26 MB file → rejected with size-limit toast; nothing uploaded to storage           ( )
delete attachment as uploader → removed; activity_logs gains task.attachment_remove         ( )
delete attachment as creator (but not uploader) → allowed per RLS                           ( )
Activity tab: last 3 entries shown; "Show all" expands to full list ordered newest-first    ( )
Comments tab: composer with MentionPicker; type "@" → user popover, arrow-key navigation    ( )
select a user via Enter/click → token "@[username](uuid)" inserted at caret                 ( )
submit comment with Ctrl+Enter → appears in thread; mentions render as blue chips           ( )
delete own comment → inline ConfirmDialog removes row; other users' comments show no delete ( )
Delete button bottom-left → ConfirmDialog (danger); confirm → cascade delete + drawer close ( )
```

### Global unread badge

```
user A creates a task assigning user B → within 20 s B's header badge increments            ( )
B opens /tasks → badge clears on mount (acknowledgeAllTasks + dispatchTasksRead)            ( )
task stays in B's list until completed or deleted (badge ≠ visibility)                      ( )
A deletes the task before B sees it → B's badge decrements on next 20 s poll                ( )
```

### Realtime

```
two sessions same user → A edits title in drawer → B's list row updates within ~1 s         ( )
A adds a comment → B's unread-comment dot appears on the row                                ( )
A uploads an attachment → B's attachment icon + count updates                               ( )
```

### Reminder delivery (requires dispatch-task-reminders edge fn + cron)

```
set reminder_offsets=[15] on a task due in ~16 min → function fires once near T-15 min      ( )
re-run dispatcher manually → no duplicate send (task_reminder_sends idempotency table)      ( )
update due_date forward → earlier send row still present; new send fires at new T-offset    ( )
```

---

## Calendar tasks overlay

_Depends on the Tasks module; toggled per user on the Calendar toolbar._

### Show Tasks toggle

```
default: toggle off; no task pills visible anywhere in calendar                             ( )
click "Show tasks" on toolbar (right, next to ViewSwitcher) → tasks appear in the view       ( )
refresh page → toggle state persists (useCalendarPreferences.showTasks, localStorage)       ( )
filter bar project filter: selecting a project prunes both events AND tasks                 ( )
filter bar participant filter: prunes both events AND tasks by assignee/creator             ( )
event-type chips do NOT affect tasks (tasks have no event_type)                             ( )
search input narrows tasks by title + description as well                                   ( )
```

### MonthView rendering

```
task pills render BELOW the up-to-3 event segments in each day cell                         ( )
task pills are thinner (h-4) and use Square/CheckSquare icon instead of left accent bar     ( )
overdue task → red left accent; status=done → line-through + dim                            ( )
cell with 4+ events AND 4+ tasks → "+N more" count sums the overflows                       ( )
click the checkbox icon → status flips todo ↔ done (optimistic, refreshes from server)      ( )
click the title → TaskDetail drawer opens (NOT the event modal)                             ( )
```

### WeekView & DayView rendering

```
all-day "Tasks" lane appears above the hour grid (only when tasks exist in range)           ( )
tasks never render inside hour slots (a due date is a deadline, not a time block)           ( )
lane label is localized ("Tasks" / "Zadaci")                                                ( )
task pill time prefix shown when task has a due_time                                        ( )
```

### AgendaView rendering

```
tasks interleave with events inside each day group, sorted by due_at / start                ( )
task rows use the shared TaskPill (checkbox + title) not the event card layout              ( )
clicking a task → TaskDetail drawer; clicking an event → EventDetailModal                   ( )
```

### NextUp sidebar

```
toggle off → NextUp shows only events                                                       ( )
toggle on → tasks due within the next 24 h are merged into the list, sorted by time         ( )
overdue tasks from earlier today still appear (filter: due_at > now - 5 min)                ( )
```

### DayEventsModal ("+N more" overflow)

```
open day overflow modal → tasks list first (above events) with a divider                    ( )
click a task pill inside the modal → modal closes, TaskDetail drawer opens                  ( )
click an event → modal closes, EventDetailModal opens (existing behavior unchanged)         ( )
```

### Cross-cutting

```
realtime: user A creates a task with a due_date in the visible month → B's calendar pill appears within ~1 s  ( )
toggling a pill checkbox → activity_logs gains task.status_change row                       ( )
switching view (month → week → agenda) → tasks re-render in the view-specific layout        ( )
```
