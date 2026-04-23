// Deno-based Supabase Edge Function.
// Scheduled via supabase/config.toml to fire every minute.
//
// For every (event, participant, offset) where the reminder fire-time
// (occurrence_start − offset_minutes) falls inside the current minute AND
// hasn't been sent yet, insert one row into calendar_notifications and one
// row into calendar_reminder_sends (idempotency ledger).
//
// Recurring events: we scan a 48-hour look-ahead window and expand RRULEs
// server-side so occurrences far from the master DTSTART still get reminded.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { RRule, rrulestr } from 'npm:rrule@2.8.1'

interface CalendarEventRow {
  id: string
  title: string
  created_by: string
  start_at: string
  end_at: string
  recurrence: string | null
  reminder_offsets: number[]
  is_private: boolean
}

interface ParticipantRow {
  event_id: string
  user_id: string
}

interface ExceptionRow {
  event_id: string
  original_start_at: string
  override_start_at: string | null
  override_end_at: string | null
  is_cancelled: boolean
}

interface ReminderSendRow {
  event_id: string
  user_id: string
  offset_minutes: number
  occurrence_start_at: string
}

const LOOKAHEAD_MS = 48 * 60 * 60 * 1000 // 48h forward
const LOOKBACK_MS = 60 * 1000             // 1 minute grace

function occurrencesForEvent(
  event: CalendarEventRow,
  windowStart: Date,
  windowEnd: Date,
  exceptionsByOriginal: Map<string, ExceptionRow>,
): Date[] {
  const baseStart = new Date(event.start_at)
  if (!event.recurrence) {
    return baseStart >= windowStart && baseStart <= windowEnd ? [baseStart] : []
  }

  const rule = (() => {
    try {
      const dtstartLine = `DTSTART:${icalUtc(baseStart)}`
      const normalized = event.recurrence.replace(/^RRULE:/, '')
      return rrulestr(`${dtstartLine}\nRRULE:${normalized}`)
    } catch {
      return null
    }
  })()
  if (!rule) return []

  const all: Date[] = rule instanceof RRule
    ? rule.between(windowStart, windowEnd, true)
    : (rule as RRule).between(windowStart, windowEnd, true)

  // Drop cancelled / shifted-out occurrences via exceptions.
  return all.filter(occ => {
    const ex = exceptionsByOriginal.get(occ.toISOString())
    if (!ex) return true
    if (ex.is_cancelled) return false
    return true
  })
}

function icalUtc(date: Date): string {
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

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const now = new Date()
  const windowStart = new Date(now.getTime() - LOOKBACK_MS)
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_MS)

  // 1. All events whose reminders might fire in the window.
  //    Non-recurring: start_at in (now-lookback, now+lookahead+maxOffset).
  //    Recurring:     all masters that have at least one reminder offset.
  //    Keeping the filter generous is fine — we filter precisely below.
  const { data: events, error: eErr } = await supabase
    .from('calendar_events')
    .select('id, title, created_by, start_at, end_at, recurrence, reminder_offsets, is_private')
    .not('reminder_offsets', 'eq', '{}')
  if (eErr) throw eErr

  const eventsTyped = (events || []) as CalendarEventRow[]
  if (eventsTyped.length === 0) {
    return new Response(JSON.stringify({ ok: true, fired: 0 }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const eventIds = eventsTyped.map(e => e.id)

  const [participantsRes, exceptionsRes, sendsRes] = await Promise.all([
    supabase
      .from('calendar_event_participants')
      .select('event_id, user_id')
      .in('event_id', eventIds),
    supabase
      .from('calendar_event_exceptions')
      .select('event_id, original_start_at, override_start_at, override_end_at, is_cancelled')
      .in('event_id', eventIds),
    supabase
      .from('calendar_reminder_sends')
      .select('event_id, user_id, offset_minutes, occurrence_start_at')
      .in('event_id', eventIds),
  ])
  if (participantsRes.error) throw participantsRes.error
  if (exceptionsRes.error) throw exceptionsRes.error
  if (sendsRes.error) throw sendsRes.error

  const participants = (participantsRes.data || []) as ParticipantRow[]
  const exceptions = (exceptionsRes.data || []) as ExceptionRow[]
  const sends = (sendsRes.data || []) as ReminderSendRow[]

  const participantsByEvent = new Map<string, string[]>()
  for (const p of participants) {
    const bucket = participantsByEvent.get(p.event_id) ?? []
    bucket.push(p.user_id)
    participantsByEvent.set(p.event_id, bucket)
  }

  const exceptionsByEvent = new Map<string, Map<string, ExceptionRow>>()
  for (const x of exceptions) {
    const bucket = exceptionsByEvent.get(x.event_id) ?? new Map()
    bucket.set(new Date(x.original_start_at).toISOString(), x)
    exceptionsByEvent.set(x.event_id, bucket)
  }

  const sendKey = (r: { event_id: string; user_id: string; offset_minutes: number; occurrence_start_at: string }) =>
    `${r.event_id}|${r.user_id}|${r.offset_minutes}|${new Date(r.occurrence_start_at).toISOString()}`
  const alreadySent = new Set<string>(sends.map(sendKey))

  const notificationRows: Array<{
    event_id: string
    user_id: string
    occurrence_start_at: string
    offset_minutes: number
    title: string
    body: string
  }> = []
  const sendRows: Array<{
    event_id: string
    user_id: string
    offset_minutes: number
    occurrence_start_at: string
  }> = []

  for (const event of eventsTyped) {
    const recipients = new Set<string>([
      event.created_by,
      ...(participantsByEvent.get(event.id) ?? []),
    ])
    if (recipients.size === 0) continue

    const exceptionsForEvent = exceptionsByEvent.get(event.id) ?? new Map<string, ExceptionRow>()

    // Look ahead far enough to cover the largest reminder offset.
    const maxOffsetMs = Math.max(...event.reminder_offsets, 0) * 60_000
    const expandStart = new Date(windowStart.getTime())
    const expandEnd = new Date(windowEnd.getTime() + maxOffsetMs)

    const occurrences = occurrencesForEvent(event, expandStart, expandEnd, exceptionsForEvent)

    for (const occ of occurrences) {
      const occIso = occ.toISOString()
      for (const offsetMinutes of event.reminder_offsets) {
        const fireAt = new Date(occ.getTime() - offsetMinutes * 60_000)
        // Fire when fireAt falls within [now-1min, now].
        if (fireAt < windowStart || fireAt > now) continue

        for (const userId of recipients) {
          const key = `${event.id}|${userId}|${offsetMinutes}|${occIso}`
          if (alreadySent.has(key)) continue
          alreadySent.add(key)

          notificationRows.push({
            event_id: event.id,
            user_id: userId,
            occurrence_start_at: occIso,
            offset_minutes: offsetMinutes,
            title: event.title,
            body: `Starts at ${occ.toISOString()}`,
          })
          sendRows.push({
            event_id: event.id,
            user_id: userId,
            offset_minutes: offsetMinutes,
            occurrence_start_at: occIso,
          })
        }
      }
    }
  }

  if (sendRows.length > 0) {
    const { error: sendErr } = await supabase
      .from('calendar_reminder_sends')
      .insert(sendRows)
    if (sendErr) {
      // Swallow duplicates — another invocation may have raced us.
      if (!String(sendErr.message).includes('duplicate')) throw sendErr
    }

    const { error: notifErr } = await supabase
      .from('calendar_notifications')
      .insert(notificationRows)
    if (notifErr) throw notifErr
  }

  return new Response(
    JSON.stringify({ ok: true, fired: notificationRows.length }),
    { headers: { 'content-type': 'application/json' } },
  )
})
