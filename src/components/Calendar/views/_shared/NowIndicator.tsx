import { useEffect, useState } from 'react'
import {
  HOUR_HEIGHT,
  VISIBLE_END_MIN,
  VISIBLE_START_MIN,
  minutesFromDayStart,
  startOfDay,
} from './timeSlots'

interface Props {
  /** Day that the timeline represents. If `now` does not fall within this day,
   *  the indicator is hidden. */
  date: Date
  /** Optional locale for the time label. */
  locale?: string
  /** Offset of the timeline grid from the left — e.g. width of the hour gutter. */
  leftOffsetPx?: number
}

export default function NowIndicator({ date, locale = 'en-US', leftOffsetPx = 0 }: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const dayStart = startOfDay(date)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  if (now < dayStart || now >= dayEnd) return null

  // Hide the indicator when "now" falls outside the visible window (before
  // DAY_START_HOUR or after DAY_END_HOUR) — the column simply does not render
  // those hours, so there is nothing to pin the line to.
  const minutesFromMidnight = minutesFromDayStart(now, dayStart)
  if (minutesFromMidnight < VISIBLE_START_MIN || minutesFromMidnight >= VISIBLE_END_MIN) {
    return null
  }

  const topPx = ((minutesFromMidnight - VISIBLE_START_MIN) / 60) * HOUR_HEIGHT

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20"
      style={{ top: `${topPx}px` }}
    >
      <div className="flex items-center" style={{ paddingLeft: leftOffsetPx }}>
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-px bg-red-500" />
      </div>
      <div
        className="absolute text-[10px] font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 px-1 rounded"
        style={{ left: Math.max(0, leftOffsetPx - 44), top: -8 }}
      >
        {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
