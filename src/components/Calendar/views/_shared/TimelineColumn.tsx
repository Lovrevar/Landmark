import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ExpandedOccurrence } from '../../utils/recurrence'
import {
  DAY_HOURS,
  HOUR_HEIGHT,
  VISIBLE_END_MIN,
  VISIBLE_START_MIN,
  minutesFromDayStart,
  startOfDay,
} from './timeSlots'
import { layoutOccurrences, type PositionedOccurrence } from './overlappingLayout'
import NowIndicator from './NowIndicator'
import { minutesToStyle, useClickToCreate, type SlotSelection } from './useClickToCreate'

// Below this card height, drop the secondary time-range line entirely — the
// title alone is more useful than a clipped "11:00 A..." below a clipped title.
const TIME_LINE_MIN_HEIGHT_PX = 40

interface Props {
  day: Date
  occurrences: ExpandedOccurrence[]
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onSlotSelect: (selection: SlotSelection) => void
  showNowIndicator?: boolean
  locale?: string
}

const typeAccent: Record<string, { bar: string; bg: string; text: string }> = {
  meeting:  { bar: 'bg-blue-500',  bg: 'bg-blue-50 dark:bg-blue-900/25',  text: 'text-blue-800 dark:text-blue-200' },
  personal: { bar: 'bg-gray-400',  bg: 'bg-gray-50 dark:bg-gray-700/40',  text: 'text-gray-800 dark:text-gray-200' },
  deadline: { bar: 'bg-red-500',   bg: 'bg-red-50 dark:bg-red-900/25',    text: 'text-red-800 dark:text-red-200' },
  reminder: { bar: 'bg-yellow-500',bg: 'bg-yellow-50 dark:bg-yellow-900/25', text: 'text-yellow-800 dark:text-yellow-200' },
}

function compactTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

interface PopoverState {
  items: PositionedOccurrence[]
  rect: DOMRect
}

interface ClusterPopoverProps {
  state: PopoverState
  locale: string
  onSelect: (occurrence: ExpandedOccurrence) => void
  onClose: () => void
}

function ClusterPopover({ state, locale, onSelect, onClose }: ClusterPopoverProps) {
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Place below the chip; shift horizontally to stay inside the viewport.
  const POPOVER_WIDTH = 280
  const left = Math.max(8, Math.min(state.rect.left, window.innerWidth - POPOVER_WIDTH - 8))
  const top = state.rect.bottom + 4

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1"
      style={{ top, left, width: POPOVER_WIDTH, maxHeight: 320, overflowY: 'auto' }}
    >
      {state.items.map(({ occurrence }) => {
        const accent = typeAccent[occurrence.event.event_type] || typeAccent.meeting
        return (
          <button
            key={occurrence.occurrenceKey}
            type="button"
            onClick={() => { onSelect(occurrence); onClose() }}
            className="w-full text-left px-2 py-1.5 rounded flex items-start gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
          >
            <span className={`flex-shrink-0 mt-1 w-1 h-6 rounded-full ${accent.bar}`} />
            <span className="flex-1 min-w-0">
              <span className={`block text-sm font-medium truncate ${occurrence.isDeclined ? 'line-through opacity-60' : ''} text-gray-900 dark:text-white`}>
                {occurrence.event.title}
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {occurrence.start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {occurrence.end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

export default function TimelineColumn({
  day,
  occurrences,
  onEventClick,
  onSlotSelect,
  showNowIndicator = true,
  locale = 'en-US',
}: Props) {
  const dayStart = startOfDay(day)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const dayOccurrences = occurrences.filter(o => o.start < dayEnd && o.end > dayStart)

  const { draft, pointerHandlers } = useClickToCreate({
    dayForPointer: () => dayStart,
    onComplete: onSlotSelect,
  })

  const clusters = layoutOccurrences(dayOccurrences)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const closePopover = useCallback(() => setPopover(null), [])

  return (
    <div
      className="relative border-l border-gray-200 dark:border-gray-700 select-none min-w-0 overflow-hidden"
      style={{ height: DAY_HOURS * HOUR_HEIGHT, boxSizing: 'border-box' }}
      {...pointerHandlers}
    >
      {Array.from({ length: DAY_HOURS }, (_, hour) => (
        <div
          key={hour}
          className="border-b border-gray-100 dark:border-gray-700/60"
          style={{ height: HOUR_HEIGHT }}
        />
      ))}

      {clusters.map(cluster => {
        // Three-way collapse: when side-by-side rendering would squeeze every
        // event to a third of the column (or less), we render only the first
        // event full-width and replace the rest with a "+N more" chip. A
        // cluster of 1 or 2 still renders all events side-by-side.
        const collapse = cluster.columnsInCluster >= 3
        const visibleItems = collapse ? [cluster.items[0]] : cluster.items
        const hiddenCount = collapse ? cluster.items.length - 1 : 0

        return (
          <React.Fragment key={cluster.items[0].occurrence.occurrenceKey}>
            {visibleItems.map(positioned => {
              const { occurrence } = positioned
              // Event timestamps are absolute (minutes from 00:00). Shift into
              // the visible window and clamp to its edges; events that don't
              // intersect the window are filtered below.
              const fromMidnightStart = minutesFromDayStart(occurrence.start, dayStart)
              const fromMidnightEnd = minutesFromDayStart(occurrence.end, dayStart)
              if (fromMidnightEnd <= VISIBLE_START_MIN || fromMidnightStart >= VISIBLE_END_MIN) {
                return null
              }
              const startMin = Math.max(0, fromMidnightStart - VISIBLE_START_MIN)
              const endMin = Math.min(DAY_HOURS * 60, fromMidnightEnd - VISIBLE_START_MIN)
              const accent = typeAccent[occurrence.event.event_type] || typeAccent.meeting

              // When we force the first event of a collapsed cluster to
              // full-width, override its column assignment.
              const columns = collapse ? 1 : positioned.columnsInCluster
              const col = collapse ? 0 : positioned.column
              const widthPct = 100 / columns
              const leftPct = col * widthPct
              const { top, height } = minutesToStyle(startMin, endMin)
              const heightPx = parseFloat(height)

              // When side-by-side, cards are narrow — drop the AM/PM suffix so
              // the range does not mid-truncate as "11:00 A...". Cards rendered
              // full-width keep the locale-native format.
              const showTimeLine = heightPx >= TIME_LINE_MIN_HEIGHT_PX
              const timeLabel = columns === 1
                ? `${occurrence.start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} – ${occurrence.end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
                : `${compactTime(occurrence.start)}–${compactTime(occurrence.end)}`

              return (
                <button
                  key={occurrence.occurrenceKey}
                  type="button"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onEventClick(occurrence) }}
                  title={`${occurrence.event.title} · ${occurrence.start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}–${occurrence.end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`}
                  className={[
                    'absolute rounded-md text-left overflow-hidden border-l-[3px]',
                    'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset',
                    'hover:brightness-110 dark:hover:brightness-125',
                    accent.bg,
                    accent.text,
                    occurrence.isDeclined ? 'opacity-60' : '',
                  ].filter(Boolean).join(' ')}
                  style={{
                    top,
                    height,
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    borderLeftColor: undefined,
                    boxSizing: 'border-box',
                  }}
                >
                  <span className={`pointer-events-none absolute left-0 top-0 bottom-0 w-[3px] ${accent.bar}`} />
                  <div className={`pl-2 pr-1 pt-0.5 text-xs font-semibold truncate leading-tight ${occurrence.isDeclined ? 'line-through' : ''}`}>
                    {occurrence.event.title}
                  </div>
                  {showTimeLine && (
                    <div className="pl-2 pr-1 text-[11px] opacity-75 truncate leading-tight">
                      {timeLabel}
                    </div>
                  )}
                </button>
              )
            })}

            {hiddenCount > 0 && (() => {
              const first = cluster.items[0].occurrence
              const fromMidnightStart = minutesFromDayStart(first.start, dayStart)
              if (fromMidnightStart >= VISIBLE_END_MIN) return null
              const startMin = Math.max(0, fromMidnightStart - VISIBLE_START_MIN)
              const chipTop = Math.round((startMin / 60) * HOUR_HEIGHT) + 2
              return (
                <button
                  key={`${cluster.items[0].occurrence.occurrenceKey}-overflow`}
                  type="button"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    setPopover({
                      items: cluster.items,
                      rect: e.currentTarget.getBoundingClientRect(),
                    })
                  }}
                  className="absolute z-10 px-2 h-5 text-[10px] font-semibold rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ top: chipTop, right: 4 }}
                >
                  +{hiddenCount} more
                </button>
              )
            })()}
          </React.Fragment>
        )
      })}

      {draft && (
        <div
          className="absolute left-1 right-1 bg-blue-400/30 border border-blue-500 rounded-md pointer-events-none"
          style={(() => {
            const top = Math.min(draft.startPx, draft.currentPx)
            const height = Math.max(12, Math.abs(draft.currentPx - draft.startPx))
            return { top: `${top}px`, height: `${height}px` }
          })()}
        />
      )}

      {showNowIndicator && <NowIndicator date={day} locale={locale} />}

      {popover && (
        <ClusterPopover
          state={popover}
          locale={locale}
          onSelect={onEventClick}
          onClose={closePopover}
        />
      )}
    </div>
  )
}
