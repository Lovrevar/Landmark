# Module: Calendar

**Path:** `src/components/Calendar/`

## Overview

Personal and shared calendar events with RSVP responses, month view, and a global header badge for unacknowledged events.

---

## Data Layer

Two tables: `calendar_events` and `calendar_event_participants` (response: `pending` | `accepted` | `declined`, plus `acknowledged_at`). Event types: `meeting`, `personal`, `deadline`, `reminder`. Private events are visible only to the creator.

### services/calendarService.ts
- `fetchEventsInRange(userId, fromIso, toIso)` — events in a date range that the user created or is a participant in; deduplicates via Map and hydrates with creator + participants
- `createEvent(input, userId)` — inserts an event row, then inserts participants (auto-accepts the creator; private events get a single self-participant row)
- `respondToEvent(participantId, response, eventId?, eventTitle?)` — sets `response` and `acknowledged_at` on a participant row
- `deleteEvent(eventId, eventTitle?)` — removes the event (cascade removes participants)
- `getUnacknowledgedEventCount(userId)` — count of participant rows where `acknowledged_at IS NULL`, used by the global badge
- `acknowledgeAllEvents(userId)` — bulk-clears unread badges by setting `acknowledged_at = now()`; logs only if at least one row was affected
- `hydrateEvents(events)` — internal helper that loads participants + creator user data
- **Depends on:** supabase client, activityLog
- **Logs:** `calendar_event.create` (medium), `calendar_event.respond` (low), `calendar_event.delete` (high), `calendar_event.acknowledge_all` (low)

---

## Hooks

### hooks/useCalendar.ts
- `useCalendar()` — owns the month anchor date, events for the visible 3-month window (anchor month ± 1), and CRUD actions
- On mount/user change, calls `acknowledgeAllEvents` then dispatches `calendar:marked-read` so the badge clears immediately when the user opens the page
- Computes `todayEvents` and `upcoming` (next 5) memoized lists
- **Calls:** calendarService.ts
- **Returns:** anchor, events, loading, todayEvents, upcoming, create, respond, remove, prevMonth, nextMonth, goToday, refresh

### hooks/useCalendarNotifications.ts
- `useCalendarNotifications()` — powers the global red badge on the calendar icon in [Layout.tsx](../src/components/Common/Layout.tsx)
- Polls `getUnacknowledgedEventCount` every 20 s
- Listens for `calendar:marked-read` window events to refresh on demand
- Exports `dispatchCalendarRead()` helper used by `useCalendar`
- **Calls:** calendarService.getUnacknowledgedEventCount
- **Returns:** unreadCount, refresh
- **Mounted in:** [Layout.tsx](../src/components/Common/Layout.tsx) (global)

---

## Views

### index.tsx (CalendarPage)
- Header (title, "New event" button), month-navigation row (prev/next/today + month label), main grid (MonthView) + sidebar (today's events, upcoming)
- All date formatting uses `i18n.language === 'hr' ? 'hr-HR' : 'en-US'` locale
- **Uses hooks:** useCalendar
- **Uses components:** MonthView, NewEventModal, EventDetailModal, DayEventsModal

### MonthView.tsx
- 6-row × 7-column month grid; each cell shows up to 3 events with a "+N more" affordance that opens DayEventsModal
- Day-of-week headers translated via `t('calendar.day_names.*')`

### NewEventModal.tsx
- Form for creating an event (title, description, location, start/end, type, all-day, private toggle, participants picker)
- Calls the hook's `create(input)` callback rather than the service directly

### EventDetailModal.tsx
- Read-only event details + RSVP buttons (accept / decline) for participants
- Creator sees a delete button that opens an inline `ConfirmDialog` (variant `danger`)

### DayEventsModal.tsx
- Modal listing every event on a specific day; clicking one opens EventDetailModal

---

## Notes
- Acknowledgement vs. response are independent: `acknowledged_at` clears the badge; `response` is the RSVP. Opening `/calendar` acknowledges everything but does not auto-RSVP
- The 3-month range fetch is intentional — it covers the visible month plus the lead-in/lead-out days from neighboring months that the grid renders
- All native `confirm()` calls have been replaced with `ConfirmDialog` per CLAUDE.md
