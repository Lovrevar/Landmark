# Collaboration

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

_Preconditions: any authenticated user; at least one other active user exists so group chats, participants and assignees can be picked. Chat and Calendar depend on Supabase Realtime being reachable — if the websocket is blocked, the features fall back to 3 s / 20 s polling._

## Calendar

_Route: `/calendar`. Global red badge sits on the calendar icon in the Layout header and reflects `calendar_event_participants.acknowledged_at IS NULL` events._

### Month view & navigation

```
open /calendar → current month grid renders (6 rows × 7 cols), today highlighted            ( )
day-of-week headers are localized to active language (HR → "Pon, Uto, ..." ; EN → "Mon, Tue, ...")  ( )
click "Next" → anchor advances one month, events re-fetch for new 3-month window            ( )
click "Prev" → anchor moves back one month                                                  ( )
click "Today" → grid jumps back to current month                                            ( )
sidebar shows "Today's events" and "Upcoming" (next 5) sections                             ( )
badge on header calendar icon clears on first visit (acknowledge_all runs on mount)         ( )
```

### Create event (NewEventModal)

_All fields default to sensible values: today's date, 09:00→10:00, type = meeting._

```
create event with all fields filled (title, description, location, participants)           ( )
create event with title empty → Create button stays disabled                                ( )
create event with date cleared → Create button stays disabled                               ( )
create event with whitespace-only title → Create button stays disabled (title.trim() check) ( )
pick each event type in turn (meeting / personal / deadline / reminder) → colored pill updates   ( )
toggle "Private" → participants picker disappears; on save event has a single self-participant ( )
select 0 participants on a non-private event → saves with only creator auto-accepted        ( )
select multiple participants → each gets a row with response='pending'                      ( )
set end_time earlier than start_time → form still saves (no client-side guard; confirm DB accepts) ( )
cancel → modal closes, no event created, list unchanged                                     ( )
close via X / Esc / backdrop → same as cancel                                               ( )
```

### Day detail & "+N more" overflow

```
day with ≤3 events → all render inline in the cell                                          ( )
day with 4+ events → shows first 3 plus "+N more" affordance                                ( )
click "+N more" → DayEventsModal opens listing every event for that day                     ( )
click an event inside DayEventsModal → EventDetailModal opens on top                        ( )
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

_Route: `/tasks`. Three tabs: Assigned to me, Created by me, Private. Global red badge on Layout for unacknowledged `task_assignees.acknowledged_at IS NULL` rows. Mutations are intentionally NOT activity-logged._

### Create task (NewTaskModal)

```
create task with title only → saves with priority=normal, no due date, no assignees         ( )
create task with title empty → Create button disabled                                       ( )
create task with whitespace-only title → Create button disabled (title.trim() check)        ( )
create task with description and due date/time → appears in list with due badge             ( )
create task with only due_time and no due_date → saves (due_date nullable)                  ( )
cycle each priority button (low / normal / high / urgent) → border highlights selected      ( )
toggle Private → assignees picker hides; on save task has 1 self-assignee auto-acknowledged ( )
create task and assign multiple users → each sees it in their "Assigned to me" tab          ( )
create non-private task with zero assignees → saves (assignee_ids=[]) — creator still sees it in "Created by me" only  ( )
cancel → modal closes, state resets on next open                                            ( )
```

### Task list tabs & cards

```
open /tasks → defaults to "Assigned to me" tab                                              ( )
tab "Created by me" → shows tasks where creator = self                                      ( )
tab "Private" → shows only private tasks created by self (lock icon on each card)           ( )
TaskCard left border color matches priority (gray/blue/orange/red)                          ( )
TaskCard shows up to 3 assignee avatars plus "+N" overflow for more                         ( )
delete button only visible to the task creator on their own cards                           ( )
```

### Status transitions

```
click status checkbox on a todo task → flips to 'done', completed_at set, card styling updates ( )
click status checkbox on a done task → flips back to 'todo', completed_at cleared           ( )
non-creator non-assignee cannot see someone else's private task (not in their list)         ( )
```

### Delete task

```
creator clicks delete → ConfirmDialog opens (pending-item pattern, not window.confirm)      ( )
confirm → task removed, assignees + comments cascade                                        ( )
cancel → task still in list                                                                 ( )
non-creator (only assignee) does NOT see a delete button                                    ( )
```

### Task detail & comments (TaskDetailModal)

```
open a task → details, assignee chips, and threaded comments render                         ( )
type comment and press Ctrl/Cmd+Enter → comment sends, appears at end of thread             ( )
send whitespace-only comment → silently no-ops (service trims and skips empty)              ( )
own comments render right-aligned, others left-aligned                                      ( )
delete own comment → inline ConfirmDialog; confirm removes the row                          ( )
try to delete another user's comment → delete button is not rendered                        ( )
close modal and reopen → comments re-fetch (hook re-runs on taskId change)                  ( )
```

### Global unread badge

```
user A creates a task assigning user B → within 20 s B's header badge increments            ( )
B opens /tasks → badge clears on mount (acknowledgeAllTasks + dispatchTasksRead)            ( )
the task itself stays in B's list until completed or deleted (badge ≠ visibility)           ( )
A deletes the task before B sees it → B's badge decrements on next 20 s poll                ( )
```
