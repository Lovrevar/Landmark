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

_Route: `/tasks`. Four tabs: **All tasks** (default), Assigned to me, Created by me, Private. Everyone sees all non-private tasks; only creator + assignees can edit or complete a task. Status is binary (open/done checkbox). Global red badge for unacknowledged `task_assignees.acknowledged_at IS NULL` rows. Every mutation is activity-logged with `entity='task'` and action `task.<verb>`. Requires the `20260706120000_simplify_tasks.sql` migration._

### Create task (TaskModal + quick-add)

```
create task with title only → saves as open (todo), no due date, no assignees               ( )
create task with title empty / whitespace-only → Create button disabled                     ( )
fill title, project, due date, 1 assignee, description → saves; description stored as plain ( )
toggle Private → assignees picker hides; on save task has 1 self-assignee auto-acknowledged ( )
Ctrl+Enter in any field → submits the form                                                  ( )
Esc with clean form → closes; Esc with dirty form → ConfirmDialog ("Discard changes?")      ( )
quick-add input at top of a project group: type title + Enter → open task created in that project ( )
quick-add on the Private tab → creates a private task; quick-add is hidden on Assigned tab  ( )
activity_logs gains one row with action='task.create' and metadata.entity_name = title      ( )
```

### Tabs, grouping, and rows

```
default tab is "All tasks"; counts in tab badges match list lengths                         ( )
All tab shows tasks created by OTHER users (org-wide visibility, non-private only)          ( )
"Assigned to me" → tasks where self is an assignee; "Created by me" → creator = self        ( )
"Private" tab → only private tasks created by self (lock icon on each row)                  ( )
private tasks of other users appear in NO tab and no search result                          ( )
list is always grouped by project (alphabetical, "Bez projekta" last)                       ( )
group header: chevron collapses/expands; collapsed state survives reload (localStorage)     ( )
group header shows task count + red "N kasni" chip when the group has overdue open tasks    ( )
within a group: open tasks by due date asc (no due date last), completed at the bottom      ( )
search box matches title + description, case-insensitive                                    ( )
"Show completed" toggle: ON by default; off → done rows hidden                              ( )
checkbox click on own/assigned task → toggles open ↔ done; row moves to bottom of group     ( )
checkbox on someone else's task is disabled with a "read only" tooltip                      ( )
checking a task sets completed_at; unchecking clears it; task.status_change logged          ( )
seed 150 tasks → virtualization kicks in (@tanstack/react-virtual); scrolling stays smooth  ( )
TaskRow left accent turns red when deadline < now AND task is open (overdue indicator)      ( )
TaskRow shows attachment icon+count (if any), unread dot (if any); no project tag (header carries it) ( )
avatars: 3 overlapping circles + "+N" chip when > 3 assignees                               ( )
```

### Task detail drawer (TaskDetail)

```
click a row → drawer slides in from the right (portal)                                      ( )
uninvolved user opens someone else's public task → fully read-only: disabled checkbox,
  disabled project/date inputs, no edit/delete buttons, no comment composer,
  comments + attachments still visible and attachments downloadable                         ( )
inline edit title → blur or Enter commits; activity_logs gains task.update row              ( )
big checkbox next to title toggles done; strikethrough applied                              ( )
change project via SearchableSelect → saves; activity_logs row includes changed_fields      ( )
clear/change due date → saves (due time is no longer editable anywhere)                     ( )
assignee picker (non-private only): add/remove → task.assign / task.unassign logged         ( )
description edits save as plain text; legacy markdown tasks still render formatted          ( )
attachments: drag-drop a ≤25 MB file → appears in list with signed-url image thumb          ( )
upload 11th file → rejected with "Maximum 10 attachments per task" toast                    ( )
delete attachment as uploader or task creator → removed; task.attachment_remove logged      ( )
comments: type "@" → user popover with arrow-key navigation; token inserted at caret        ( )
submit comment with Ctrl+Enter → appears in thread; mentions render as blue chips           ( )
comment create/edit/delete still works for creator and assignee (RLS tightening check)      ( )
delete own comment → removed; other users' comments show no delete                          ( )
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
two sessions, different users → A edits title in drawer → B's All-tab row updates within ~1 s ( )
A adds a comment → B's unread-comment count updates on the row                              ( )
A creates a private task → it never appears in B's list, even via realtime refresh          ( )
rapid successive edits → list refetches once (300 ms debounce), not per event               ( )
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
overdue task → red left accent; completed → line-through + dim                              ( )
cell with 4+ events AND 4+ tasks → "+N more" count sums the overflows                       ( )
click the checkbox icon → completed flips on ↔ off (optimistic, refreshes from server)      ( )
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
