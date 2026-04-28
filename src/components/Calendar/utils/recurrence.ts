import { RRule, rrulestr } from 'rrule'
import type { CalendarEvent, EventResponse } from '../../../types/tasks'

export interface ExpandedOccurrence {
  occurrenceKey: string       // unique per occurrence: `${event.id}:${startIso}`
  event: CalendarEvent
  start: Date
  end: Date
  originalStartIso: string    // the untransformed RRULE occurrence key — stable across exceptions
  isRecurringInstance: boolean
  isException: boolean
  myResponse: EventResponse          // resolved: occurrence override > master > 'pending'
  myParticipantId: string | null     // master participants row id (for series-scope actions)
  isDeclined: boolean                // convenience flag for UI dimming
}

function parseRule(rule: string, dtstart: Date): RRule | null {
  try {
    const parsed = rrulestr(rule.includes('DTSTART') ? rule : `DTSTART:${toIcalLocal(dtstart)}\nRRULE:${rule.replace(/^RRULE:/, '')}`)
    if (parsed instanceof RRule) return parsed
    // rrulestr may return an RRuleSet; the set also has .between(), so accept that by duck-typing
    return parsed as unknown as RRule
  } catch {
    return null
  }
}

function toIcalLocal(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

function resolveResponse(
  event: CalendarEvent,
  originalStartIso: string,
  currentUserId: string | null,
): { myResponse: EventResponse; myParticipantId: string | null } {
  if (!currentUserId) return { myResponse: 'pending', myParticipantId: null }

  const master = event.participants?.find(p => p.user_id === currentUserId) ?? null
  const override = event.occurrence_responses?.find(
    r => r.user_id === currentUserId
      && new Date(r.original_start_at).toISOString() === originalStartIso,
  )
  const myResponse: EventResponse = override?.response ?? master?.response ?? 'pending'
  return { myResponse, myParticipantId: master?.id ?? null }
}

export function expandEvents(
  events: CalendarEvent[],
  windowStart: Date,
  windowEnd: Date,
  currentUserId: string | null = null,
): ExpandedOccurrence[] {
  const out: ExpandedOccurrence[] = []

  for (const event of events) {
    const baseStart = new Date(event.start_at)
    const baseEnd = new Date(event.end_at)
    const durationMs = baseEnd.getTime() - baseStart.getTime()

    // Build a quick lookup of exceptions keyed by the original occurrence start (UTC ISO).
    type ExceptionRow = NonNullable<CalendarEvent['exceptions']>[number]
    const exceptionsByOriginal = new Map<string, ExceptionRow>()
    ;(event.exceptions || []).forEach(x => {
      exceptionsByOriginal.set(new Date(x.original_start_at).toISOString(), x)
    })

    if (!event.recurrence) {
      // Non-recurring: include only if it overlaps the window.
      if (baseStart < windowEnd && baseEnd > windowStart) {
        const originalStartIso = baseStart.toISOString()
        const { myResponse, myParticipantId } = resolveResponse(event, originalStartIso, currentUserId)
        out.push({
          occurrenceKey: `${event.id}:${originalStartIso}`,
          event,
          start: baseStart,
          end: baseEnd,
          originalStartIso,
          isRecurringInstance: false,
          isException: false,
          myResponse,
          myParticipantId,
          isDeclined: myResponse === 'declined',
        })
      }
      continue
    }

    const rule = parseRule(event.recurrence, baseStart)
    if (!rule) continue

    // Fetch all occurrences within the window. rrule .between() is inclusive-exclusive
    // by default; pass `true` for inclusive endpoint behavior.
    let occurrences: Date[] = []
    try {
      occurrences = rule.between(windowStart, windowEnd, true)
    } catch {
      occurrences = []
    }

    for (const occurrenceStart of occurrences) {
      const originalKey = occurrenceStart.toISOString()
      const exception = exceptionsByOriginal.get(originalKey)

      if (exception?.is_cancelled) continue

      const start = exception?.override_start_at
        ? new Date(exception.override_start_at)
        : occurrenceStart
      const end = exception?.override_end_at
        ? new Date(exception.override_end_at)
        : new Date(start.getTime() + durationMs)

      // Exception may shift outside the window — re-check overlap.
      if (start >= windowEnd || end <= windowStart) continue

      const { myResponse, myParticipantId } = resolveResponse(event, originalKey, currentUserId)

      out.push({
        occurrenceKey: `${event.id}:${originalKey}`,
        event: exception?.override_title
          ? { ...event, title: exception.override_title }
          : event,
        start,
        end,
        originalStartIso: originalKey,
        isRecurringInstance: true,
        isException: !!exception,
        myResponse,
        myParticipantId,
        isDeclined: myResponse === 'declined',
      })
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}
