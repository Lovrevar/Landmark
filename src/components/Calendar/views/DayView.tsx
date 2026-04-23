import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExpandedOccurrence } from '../utils/recurrence'
import type { TaskOccurrence } from '../utils/expandTasks'
import TaskPill from '../components/TaskPill'
import TimelineColumn from './_shared/TimelineColumn'
import { DAY_HOURS, DAY_START_HOUR, HOUR_HEIGHT, formatHourLabel, startOfDay } from './_shared/timeSlots'
import type { SlotSelection } from './_shared/useClickToCreate'

interface Props {
  date: Date
  occurrences: ExpandedOccurrence[]
  taskOccurrences?: TaskOccurrence[]
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onTaskClick?: (occurrence: TaskOccurrence) => void
  onTaskToggle?: (occurrence: TaskOccurrence) => void
  onSlotSelect: (selection: SlotSelection) => void
}

const HOUR_GUTTER_PX = 56

export default function DayView({
  date,
  occurrences,
  taskOccurrences = [],
  onEventClick,
  onTaskClick,
  onTaskToggle,
  onSlotSelect,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const dayStart = startOfDay(date)
  const isToday = dayStart.toDateString() === new Date().toDateString()
  const dayTasks = useMemo(() => {
    const key = dayStart.toDateString()
    return taskOccurrences.filter(o => o.due_at.toDateString() === key)
  }, [taskOccurrences, dayStart])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: `${HOUR_GUTTER_PX}px 1fr` }}>
        <div className="border-r border-gray-200 dark:border-gray-700" />
        <div className="py-2 px-3 text-center border-b border-gray-200 dark:border-gray-700">
          <div className={`text-xs uppercase ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {date.toLocaleDateString(locale, { weekday: 'short' })}
          </div>
          <div className={`text-lg font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
            {date.getDate()}
          </div>
        </div>
      </div>
      {dayTasks.length > 0 && (
        <div className="grid border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: `${HOUR_GUTTER_PX}px 1fr` }}>
          <div className="text-[10px] uppercase text-gray-400 dark:text-gray-500 text-right pr-2 pt-1.5 border-r border-gray-200 dark:border-gray-700">
            {t('calendar.task_pill.lane')}
          </div>
          <div className="p-1.5 space-y-1">
            {dayTasks.map(o => (
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
        </div>
      )}
      <div className="relative overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div className="grid" style={{ gridTemplateColumns: `${HOUR_GUTTER_PX}px 1fr` }}>
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
          <TimelineColumn
            day={dayStart}
            occurrences={occurrences}
            onEventClick={onEventClick}
            onSlotSelect={onSlotSelect}
            locale={locale}
          />
        </div>
      </div>
    </div>
  )
}
