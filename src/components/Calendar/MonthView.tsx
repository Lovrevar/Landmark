import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Repeat, MapPin, Users, Square, CheckSquare } from 'lucide-react'
import type { EventType } from '../../types/tasks'
import type { ExpandedOccurrence } from './utils/recurrence'
import type { TaskOccurrence } from './utils/expandTasks'
import { computeMonthLayout, type PlacedSegment } from './utils/monthLayout'

interface Props {
  anchor: Date
  occurrences: ExpandedOccurrence[]
  taskOccurrences?: TaskOccurrence[]
  onDayClick: (date: Date) => void
  onEmptyCellClick: (date: Date) => void
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onTaskClick?: (occurrence: TaskOccurrence) => void
  onTaskToggle?: (occurrence: TaskOccurrence) => void
}

const typeAccent: Record<EventType, string> = {
  meeting: 'border-l-blue-500',
  personal: 'border-l-gray-400',
  deadline: 'border-l-red-500',
  reminder: 'border-l-amber-500',
}

const typeBarBg: Record<EventType, string> = {
  meeting: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  personal: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200',
  deadline: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200',
  reminder: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
}

const dayNameKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const MAX_VISIBLE_SLOTS = 3
const SLOT_HEIGHT_PX = 22
const HEADER_HEIGHT_PX = 28
const ROW_MIN_HEIGHT_PX = 120
const TASK_SLOT_HEIGHT_PX = 18
const MAX_TASK_SLOTS = 3

interface DayCellProps {
  date: Date
  isThisMonth: boolean
  isToday: boolean
  isWeekend: boolean
  overflowCount: number
  onCellClick: (date: Date) => void
  onMoreClick: (date: Date) => void
  moreLabel: string
}

const DayCell = React.memo(function DayCell({
  date,
  isThisMonth,
  isToday,
  isWeekend,
  overflowCount,
  onCellClick,
  onMoreClick,
  moreLabel,
}: DayCellProps) {
  const baseBg = !isThisMonth
    ? 'bg-gray-50/60 dark:bg-gray-900/40'
    : isWeekend
      ? 'bg-gray-50/40 dark:bg-gray-900/20'
      : ''
  return (
    <div
      onClick={() => onCellClick(date)}
      className={[
        'relative border-r border-b border-gray-200 dark:border-gray-700 cursor-pointer',
        'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors',
        baseBg,
      ].join(' ')}
      style={{ minHeight: ROW_MIN_HEIGHT_PX }}
    >
      <div className="flex items-center justify-end px-2 pt-1.5">
        <span
          className={[
            'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs',
            isToday
              ? 'bg-blue-600 text-white font-semibold'
              : isThisMonth
                ? 'text-gray-700 dark:text-gray-200'
                : 'text-gray-400 dark:text-gray-600',
          ].join(' ')}
        >
          {date.getDate()}
        </span>
      </div>
      {overflowCount > 0 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onMoreClick(date) }}
          className="absolute left-1.5 right-1.5 bottom-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
        >
          {moreLabel}
        </button>
      )}
    </div>
  )
}, (prev, next) =>
  prev.date.getTime() === next.date.getTime() &&
  prev.isThisMonth === next.isThisMonth &&
  prev.isToday === next.isToday &&
  prev.isWeekend === next.isWeekend &&
  prev.overflowCount === next.overflowCount &&
  prev.onCellClick === next.onCellClick &&
  prev.onMoreClick === next.onMoreClick &&
  prev.moreLabel === next.moreLabel
)

function formatTime(d: Date, locale: string): string {
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

const MonthView: React.FC<Props> = ({
  anchor,
  occurrences,
  taskOccurrences = [],
  onDayClick,
  onEmptyCellClick,
  onEventClick,
  onTaskClick,
  onTaskToggle,
}) => {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'

  const { cells, gridStart, monthIdx } = useMemo(() => {
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const start = new Date(year, month, 1 - startOffset)
    start.setHours(0, 0, 0, 0)

    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push(d)
    }
    return { cells, gridStart: start, monthIdx: month }
  }, [anchor])

  const layout = useMemo(() => computeMonthLayout(occurrences, gridStart), [occurrences, gridStart])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskOccurrence[]>()
    for (const t of taskOccurrences) {
      const key = t.due_at.toDateString()
      const list = map.get(key) || []
      list.push(t)
      map.set(key, list)
    }
    return map
  }, [taskOccurrences])

  const todayStr = new Date().toDateString()

  const renderSegment = (seg: PlacedSegment) => {
    if (seg.slot >= MAX_VISIBLE_SLOTS) return null
    const widthPct = ((seg.endCol - seg.startCol + 1) / 7) * 100
    const leftPct = (seg.startCol / 7) * 100
    const top = HEADER_HEIGHT_PX + seg.slot * SLOT_HEIGHT_PX
    const occ = seg.occurrence
    const ev = occ.event
    const participantCount = ev.participants?.length ?? 0
    const isMultiDay = seg.endCol > seg.startCol || seg.continuesLeft || seg.continuesRight

    return (
      <button
        key={`${occ.occurrenceKey}:${seg.startCol}`}
        type="button"
        onClick={e => { e.stopPropagation(); onEventClick(occ) }}
        style={{
          position: 'absolute',
          top,
          left: `calc(${leftPct}% + 4px)`,
          width: `calc(${widthPct}% - 8px)`,
          height: SLOT_HEIGHT_PX - 2,
        }}
        className={[
          'text-left text-xs px-1.5 flex items-center gap-1 overflow-hidden',
          'border-l-[3px] rounded-sm',
          typeAccent[ev.event_type],
          typeBarBg[ev.event_type],
          seg.continuesLeft ? 'rounded-l-none' : '',
          seg.continuesRight ? 'rounded-r-none' : '',
          'hover:shadow-sm hover:brightness-105 dark:hover:brightness-125 transition-all',
          occ.isDeclined ? 'opacity-60 line-through' : '',
        ].filter(Boolean).join(' ')}
        title={ev.title}
      >
        {!seg.continuesLeft && !isMultiDay && (
          <span className="text-[11px] opacity-70 flex-shrink-0">
            {formatTime(occ.start, dateLocale)}
          </span>
        )}
        <span className="truncate font-medium">{ev.title}</span>
        <span className="flex items-center gap-0.5 ml-auto flex-shrink-0 opacity-80">
          {ev.recurrence && <Repeat className="w-2.5 h-2.5" />}
          {ev.location && <MapPin className="w-2.5 h-2.5" />}
          {participantCount > 0 && <Users className="w-2.5 h-2.5" />}
        </span>
      </button>
    )
  }

  const overflowForCell = (date: Date): number => {
    const used = layout.slotsByDay.get(date.toDateString()) ?? 0
    const eventOverflow = Math.max(0, used - MAX_VISIBLE_SLOTS)
    const taskCount = tasksByDay.get(date.toDateString())?.length ?? 0
    const taskOverflow = Math.max(0, taskCount - MAX_TASK_SLOTS)
    return eventOverflow + taskOverflow
  }

  const renderTaskPill = (occ: TaskOccurrence, colIdx: number, slotIdx: number) => {
    if (slotIdx >= MAX_TASK_SLOTS) return null
    const usedEventSlots = Math.min(
      layout.slotsByDay.get(occ.due_at.toDateString()) ?? 0,
      MAX_VISIBLE_SLOTS,
    )
    const top = HEADER_HEIGHT_PX + usedEventSlots * SLOT_HEIGHT_PX + slotIdx * TASK_SLOT_HEIGHT_PX
    const widthPct = (1 / 7) * 100
    const leftPct = (colIdx / 7) * 100
    const ToggleIcon = occ.isDone ? CheckSquare : Square
    return (
      <div
        key={occ.occurrenceKey}
        style={{
          position: 'absolute',
          top,
          left: `calc(${leftPct}% + 4px)`,
          width: `calc(${widthPct}% - 8px)`,
          height: TASK_SLOT_HEIGHT_PX - 2,
        }}
        className={[
          'flex items-center gap-1 px-1 overflow-hidden text-[11px]',
          'rounded-sm bg-gray-100 dark:bg-gray-700/60 text-gray-800 dark:text-gray-200',
          occ.isOverdue ? 'border-l-[3px] border-l-red-500' : 'border-l-[3px] border-l-transparent',
          occ.isDone ? 'opacity-60 line-through' : '',
        ].filter(Boolean).join(' ')}
        title={occ.task.title}
      >
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onTaskToggle?.(occ) }}
          className="flex-shrink-0 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ToggleIcon className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onTaskClick?.(occ) }}
          className="truncate text-left flex-1 hover:underline"
        >
          {occ.task.title}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {dayNameKeys.map(key => (
          <div key={key} className="py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
            {t(`calendar.day_names.${key}`)}
          </div>
        ))}
      </div>

      <div>
        {[0, 1, 2, 3, 4, 5].map(rowIdx => (
          <div key={rowIdx} className="relative grid grid-cols-7">
            {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((d, colIdx) => {
              const key = d.toDateString()
              const isThisMonth = d.getMonth() === monthIdx
              const isToday = key === todayStr
              const dow = d.getDay()
              const isWeekend = dow === 0 || dow === 6
              const overflow = overflowForCell(d)
              return (
                <DayCell
                  key={colIdx}
                  date={d}
                  isThisMonth={isThisMonth}
                  isToday={isToday}
                  isWeekend={isWeekend}
                  overflowCount={overflow}
                  onCellClick={onEmptyCellClick}
                  onMoreClick={onDayClick}
                  moreLabel={t('calendar.more_events', { count: overflow })}
                />
              )
            })}
            <div className="absolute inset-0 pointer-events-none">
              <div className="relative w-full h-full pointer-events-auto">
                {layout.segmentsByWeek[rowIdx].map(seg => renderSegment(seg))}
                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((d, colIdx) => {
                  const items = tasksByDay.get(d.toDateString()) || []
                  return items.map((occ, slotIdx) => renderTaskPill(occ, colIdx, slotIdx))
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MonthView
