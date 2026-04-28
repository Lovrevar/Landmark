import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExpandedOccurrence } from '../utils/recurrence'
import type { TaskOccurrence } from '../utils/expandTasks'
import TaskPill from '../components/TaskPill'
import TimelineColumn from './_shared/TimelineColumn'
import {
  DAY_HOURS,
  DAY_START_HOUR,
  HOUR_HEIGHT,
  addDays,
  formatHourLabel,
  startOfWeek,
} from './_shared/timeSlots'
import type { SlotSelection } from './_shared/useClickToCreate'

interface Props {
  anchor: Date
  occurrences: ExpandedOccurrence[]
  taskOccurrences?: TaskOccurrence[]
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onTaskClick?: (occurrence: TaskOccurrence) => void
  onTaskToggle?: (occurrence: TaskOccurrence) => void
  onSlotSelect: (selection: SlotSelection) => void
}

const HOUR_GUTTER_PX = 56

export default function WeekView({
  anchor,
  occurrences,
  taskOccurrences = [],
  onEventClick,
  onTaskClick,
  onTaskToggle,
  onSlotSelect,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const todayStr = new Date().toDateString()
  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskOccurrence[]>()
    for (const o of taskOccurrences) {
      const key = o.due_at.toDateString()
      const list = map.get(key) || []
      list.push(o)
      map.set(key, list)
    }
    return map
  }, [taskOccurrences])
  const hasAnyTasks = taskOccurrences.length > 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(7, minmax(0, 1fr))` }}>
        <div />
        {days.map((d, i) => {
          const isToday = d.toDateString() === todayStr
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          return (
            <div key={i} className="py-2 text-center">
              <div className={[
                'text-[11px] uppercase',
                isToday ? 'text-blue-600 dark:text-blue-400' : isWeekend ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400',
              ].join(' ')}>
                {d.toLocaleDateString(locale, { weekday: 'short' })}
              </div>
              <div className={[
                'text-base font-semibold',
                isToday ? 'inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white' : isWeekend ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white',
              ].join(' ')}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>
      {hasAnyTasks && (
        <div className="grid border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(7, minmax(0, 1fr))` }}>
          <div className="text-[10px] uppercase text-gray-400 dark:text-gray-500 text-right pr-2 pt-1.5 border-r border-gray-200 dark:border-gray-700">
            {t('calendar.task_pill.lane')}
          </div>
          {days.map((d, i) => {
            const items = tasksByDay.get(d.toDateString()) || []
            return (
              // min-w-0 + overflow-hidden force the grid track to honour its
              // 1fr width; without these, a long task title's intrinsic
              // min-content size lets the cell push past its track and bleed
              // into the next day column.
              <div key={i} className="min-w-0 overflow-hidden p-1 space-y-1 border-r border-gray-100 dark:border-gray-700/60 last:border-r-0">
                {items.map(o => (
                  <TaskPill
                    key={o.occurrenceKey}
                    occurrence={o}
                    onClick={onTaskClick}
                    onToggle={onTaskToggle}
                    compact
                    showTime
                    locale={locale}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
      <div className="relative overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div className="grid" style={{ gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(7, minmax(0, 1fr))` }}>
          <div>
            {Array.from({ length: DAY_HOURS }, (_, i) => {
              const hour = DAY_START_HOUR + i
              return (
                <div
                  key={hour}
                  className="text-[11px] text-gray-500 dark:text-gray-400 text-right pr-2 border-r border-gray-200 dark:border-gray-700"
                  style={{ height: HOUR_HEIGHT }}
                >
                  {formatHourLabel(hour, locale)}
                </div>
              )
            })}
          </div>
          {days.map((d, i) => (
            <TimelineColumn
              key={i}
              day={d}
              occurrences={occurrences}
              onEventClick={onEventClick}
              onSlotSelect={onSlotSelect}
              locale={locale}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
