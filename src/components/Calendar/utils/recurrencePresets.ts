import { RRule, Frequency, Weekday } from 'rrule'

export type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type RecurrenceEndKind = 'never' | 'on' | 'after'

export interface RecurrenceState {
  preset: RecurrencePreset
  endKind: RecurrenceEndKind
  endDate: string        // YYYY-MM-DD, used when endKind === 'on'
  endCount: number       // used when endKind === 'after'
  customInterval: number // used when preset === 'custom'
  customFreq: 'daily' | 'weekly' | 'monthly' // used when preset === 'custom'
  customByWeekday: number[] // 0=Mon..6=Sun in rrule convention; used when customFreq === 'weekly'
}

export const DEFAULT_RECURRENCE: RecurrenceState = {
  preset: 'none',
  endKind: 'never',
  endDate: '',
  endCount: 10,
  customInterval: 1,
  customFreq: 'weekly',
  customByWeekday: [],
}

const WEEKDAYS: Weekday[] = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]

function startWeekdayIndex(startDate: Date): number {
  // JS: 0=Sun..6=Sat. rrule: 0=Mon..6=Sun.
  const js = startDate.getDay()
  return (js + 6) % 7
}

function buildEnd(state: RecurrenceState): { until?: Date; count?: number } {
  if (state.endKind === 'on' && state.endDate) {
    const d = new Date(`${state.endDate}T23:59:59`)
    return { until: d }
  }
  if (state.endKind === 'after') {
    return { count: Math.max(1, state.endCount) }
  }
  return {}
}

export function serializeRecurrence(state: RecurrenceState, startDate: Date): string | null {
  if (state.preset === 'none') return null

  const end = buildEnd(state)
  let rule: RRule

  if (state.preset === 'daily') {
    rule = new RRule({ freq: Frequency.DAILY, ...end })
  } else if (state.preset === 'weekly') {
    rule = new RRule({
      freq: Frequency.WEEKLY,
      byweekday: [WEEKDAYS[startWeekdayIndex(startDate)]],
      ...end,
    })
  } else if (state.preset === 'monthly') {
    rule = new RRule({
      freq: Frequency.MONTHLY,
      bymonthday: [startDate.getDate()],
      ...end,
    })
  } else if (state.preset === 'yearly') {
    rule = new RRule({
      freq: Frequency.YEARLY,
      bymonth: [startDate.getMonth() + 1],
      bymonthday: [startDate.getDate()],
      ...end,
    })
  } else {
    // custom
    const freq =
      state.customFreq === 'daily'
        ? Frequency.DAILY
        : state.customFreq === 'weekly'
          ? Frequency.WEEKLY
          : Frequency.MONTHLY

    const opts: ConstructorParameters<typeof RRule>[0] = {
      freq,
      interval: Math.max(1, state.customInterval),
      ...end,
    }
    if (state.customFreq === 'weekly') {
      const days = state.customByWeekday.length > 0
        ? state.customByWeekday
        : [startWeekdayIndex(startDate)]
      opts.byweekday = days.map(i => WEEKDAYS[i])
    } else if (state.customFreq === 'monthly') {
      opts.bymonthday = [startDate.getDate()]
    }
    rule = new RRule(opts)
  }

  // rrule.toString() prefixes with "RRULE:"
  return rule.toString().replace(/^RRULE:/, '')
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const WEEKDAY_STRS: string[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

/**
 * A stored rule as one line of text, for the edit form where a series' timing is read-only.
 *
 * Deliberately not rrule's `toText()`: that is English-only, and would put "every week on
 * Monday for 10 times" into the Croatian UI. This reads the parsed rule and reuses the labels
 * the recurrence picker already shows, so the description matches what the creator picked:
 * "Weekly (Mon) · Ends: After 10 occurrence(s)". A rule the picker cannot produce falls back
 * to the generic "Recurring" label rather than a wrong description.
 */
export function describeRecurrence(rule: string, t: Translate, locale: string): string {
  let options: Partial<ReturnType<typeof RRule.parseString>>
  try {
    options = RRule.parseString(rule.replace(/^RRULE:/, ''))
  } catch {
    return t('calendar.detail.recurring')
  }

  const freqKey =
    options.freq === Frequency.DAILY ? 'daily'
      : options.freq === Frequency.WEEKLY ? 'weekly'
        : options.freq === Frequency.MONTHLY ? 'monthly'
          : options.freq === Frequency.YEARLY ? 'yearly'
            : null
  if (!freqKey) return t('calendar.detail.recurring')

  const interval = options.interval ?? 1
  let text =
    interval > 1 && freqKey !== 'yearly'
      ? `${t('calendar.modal.recurrence.every')} ${interval} ${t(`calendar.modal.recurrence.freq.${freqKey}`)}`
      : t(`calendar.modal.recurrence.preset.${freqKey}`)

  if (freqKey === 'weekly' && options.byweekday) {
    const raw = Array.isArray(options.byweekday) ? options.byweekday : [options.byweekday]
    const days = raw
      .map(w => (typeof w === 'number' ? w : typeof w === 'string' ? WEEKDAY_STRS.indexOf(w) : w.weekday))
      .filter(i => i >= 0 && i < DAY_KEYS.length)
      .sort((a, b) => a - b)
      .map(i => t(`calendar.day_names.${DAY_KEYS[i]}`))
    if (days.length > 0) text += ` (${days.join(', ')})`
  }

  const ends = t('calendar.modal.recurrence.ends')
  if (options.count) {
    text += ` · ${ends}: ${t('calendar.modal.recurrence.end.after')} ${options.count} ${t('calendar.modal.recurrence.occurrences')}`
  } else if (options.until) {
    text += ` · ${ends}: ${options.until.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return text
}
