import React, { useMemo } from 'react'
import type { CalendarEvent, EventType } from '../../types/tasks'

interface Props {
  anchor: Date
  events: CalendarEvent[]
  onDayClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

const typeDot: Record<EventType, string> = {
  meeting: 'bg-blue-500',
  personal: 'bg-gray-400',
  deadline: 'bg-red-500',
  reminder: 'bg-yellow-500',
}

const typeBg: Record<EventType, string> = {
  meeting: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  personal: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  deadline: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  reminder: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200',
}

const dayNames = ['Pon', 'Uto', 'Sri', 'Cet', 'Pet', 'Sub', 'Ned']

const MonthView: React.FC<Props> = ({ anchor, events, onDayClick, onEventClick }) => {
  const { cells, monthIdx } = useMemo(() => {
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
    const start = new Date(year, month, 1 - startOffset)

    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push(d)
    }
    return { cells, monthIdx: month }
  }, [anchor])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach(e => {
      const key = new Date(e.start_at).toDateString()
      const list = map.get(key) || []
      list.push(e)
      map.set(key, list)
    })
    return map
  }, [events])

  const todayStr = new Date().toDateString()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {dayNames.map(n => (
          <div key={n} className="py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = d.toDateString()
          const dayEvents = eventsByDay.get(key) || []
          const isThisMonth = d.getMonth() === monthIdx
          const isToday = key === todayStr
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={`min-h-[110px] border-r border-b border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 ${isThisMonth ? '' : 'bg-gray-50/50 dark:bg-gray-900/40'}`}
            >
              <div className={`text-sm mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-blue-600 text-white font-semibold' : isThisMonth ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(e => (
                  <button
                    key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                    className={`w-full text-left px-2 py-0.5 text-xs rounded truncate flex items-center gap-1 ${typeBg[e.event_type]}`}
                    title={e.title}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${typeDot[e.event_type]}`} />
                    <span className="truncate">
                      {new Date(e.start_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })} {e.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 px-2">+{dayEvents.length - 3} jos</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MonthView
