import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Repeat, MapPin, Users } from 'lucide-react'
import type { ExpandedOccurrence } from './utils/recurrence'
import type { TaskOccurrence } from './utils/expandTasks'
import { cellRows, computeMonthLayout, type CellRows, type PlacedSegment } from './utils/monthLayout'
import { EVENT_TYPE_COLORS } from './utils/eventTypeColors'
import TaskPill from './components/TaskPill'
import { intlLocale } from '../../utils/locale'

interface Props {
  anchor: Date
  occurrences: ExpandedOccurrence[]
  taskOccurrences?: TaskOccurrence[]
  onDayClick: (date: Date) => void
  onEmptyCellClick: (date: Date) => void
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onTaskClick?: (occurrence: TaskOccurrence) => void
  onTaskToggle?: (occurrence: TaskOccurrence) => void
  /** The signed-in user's auth id; decides whether a task's checkbox is live. */
  currentUserId?: string | null
}

const dayNameKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// The height budget of one cell: the date header, then MAX_VISIBLE_SLOTS rows, then the "+N more"
// line pinned to the bottom (bottom-1 + one 11px line, so it starts ~99px down). 28 + 3 × 22 = 94
// clears it. Event bars and task pills share those rows (see cellRows): tasks used to get three
// rows of their own below the events, and on a busy day ran past the cell into the next week.
// Both are 20px tall in a 22px row — TaskPill's compact size is h-5.
const MAX_VISIBLE_SLOTS = 3
const SLOT_HEIGHT_PX = 22
const HEADER_HEIGHT_PX = 28
const ROW_MIN_HEIGHT_PX = 120

const NO_SLOTS: number[] = []

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
  currentUserId,
}) => {
  const { t, i18n } = useTranslation()
  const dateLocale = intlLocale(i18n.language)

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

  // Which rows each day's tasks take and how many items go to "+N more" — one computation, so
  // the pills drawn and the count shown cannot disagree.
  const rowsByDay = useMemo(() => {
    const map = new Map<string, CellRows>()
    for (const d of cells) {
      const key = d.toDateString()
      const taskCount = tasksByDay.get(key)?.length ?? 0
      map.set(key, cellRows(layout.eventSlotsByDay.get(key) ?? NO_SLOTS, taskCount, MAX_VISIBLE_SLOTS))
    }
    return map
  }, [cells, layout, tasksByDay])

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
          'pointer-events-auto text-left text-xs px-1.5 flex items-center gap-1 overflow-hidden',
          'border-l-[3px] rounded-sm',
          EVENT_TYPE_COLORS[ev.event_type].border,
          EVENT_TYPE_COLORS[ev.event_type].surface,
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

  const overflowForCell = (date: Date): number => rowsByDay.get(date.toDateString())?.hiddenCount ?? 0

  // The shared TaskPill, not a hand-drawn copy of it: the copy showed no task colour and had to
  // re-implement the checkbox rules (checklist, read-only). With no onTaskToggle the pill's
  // checkbox renders disabled.
  const renderTaskPill = (occ: TaskOccurrence, colIdx: number, row: number) => {
    const top = HEADER_HEIGHT_PX + row * SLOT_HEIGHT_PX
    const widthPct = (1 / 7) * 100
    const leftPct = (colIdx / 7) * 100
    return (
      <div
        key={occ.occurrenceKey}
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          top,
          left: `calc(${leftPct}% + 4px)`,
          width: `calc(${widthPct}% - 8px)`,
          height: SLOT_HEIGHT_PX - 2,
        }}
      >
        <TaskPill
          compact
          occurrence={occ}
          currentUserId={currentUserId}
          onClick={onTaskClick}
          onToggle={onTaskToggle}
          locale={dateLocale}
        />
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
            {/* Only the bars and pills take clicks. The layer itself stays click-through, so a
                click on empty space still reaches the cell below it (new event) and its
                "+N more" link — a pointer-events-auto layer the size of the row swallowed both. */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="relative w-full h-full">
                {layout.segmentsByWeek[rowIdx].map(seg => renderSegment(seg))}
                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((d, colIdx) => {
                  const key = d.toDateString()
                  const items = tasksByDay.get(key) || []
                  const rows = rowsByDay.get(key)?.taskRows ?? NO_SLOTS
                  return rows.map((row, i) => renderTaskPill(items[i], colIdx, row))
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
