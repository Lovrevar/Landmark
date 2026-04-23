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
