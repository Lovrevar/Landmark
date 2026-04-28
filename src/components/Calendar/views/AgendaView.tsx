import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, MapPin } from 'lucide-react'
import type { EventType } from '../../../types/tasks'
import type { ExpandedOccurrence } from '../utils/recurrence'
import type { TaskOccurrence } from '../utils/expandTasks'
import TaskPill from '../components/TaskPill'

interface Props {
  occurrences: ExpandedOccurrence[]
  taskOccurrences?: TaskOccurrence[]
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onTaskClick?: (occurrence: TaskOccurrence) => void
  onTaskToggle?: (occurrence: TaskOccurrence) => void
}

type AgendaItem =
  | { kind: 'event'; occ: ExpandedOccurrence; sortAt: number }
  | { kind: 'task'; occ: TaskOccurrence; sortAt: number }

const typeAccent: Record<EventType, string> = {
  meeting: 'border-l-blue-500',
  personal: 'border-l-gray-400',
  deadline: 'border-l-red-500',
  reminder: 'border-l-yellow-500',
}

interface DayGroup {
  key: string
  date: Date
  items: AgendaItem[]
}

export default function AgendaView({
  occurrences,
  taskOccurrences = [],
  onEventClick,
  onTaskClick,
  onTaskToggle,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>()
    for (const occ of occurrences) {
      const key = occ.start.toDateString()
      if (!map.has(key)) {
        map.set(key, { key, date: new Date(occ.start), items: [] })
      }
      map.get(key)!.items.push({ kind: 'event', occ, sortAt: occ.start.getTime() })
    }
    for (const t of taskOccurrences) {
      const key = t.due_at.toDateString()
      if (!map.has(key)) {
        map.set(key, { key, date: new Date(t.due_at), items: [] })
      }
      map.get(key)!.items.push({ kind: 'task', occ: t, sortAt: t.due_at.getTime() })
    }
    for (const g of map.values()) g.items.sort((a, b) => a.sortAt - b.sortAt)
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [occurrences, taskOccurrences])

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {t('calendar.no_events_in_range')}
      </div>
    )
  }

  const todayStr = new Date().toDateString()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
      {groups.map(group => {
        const isToday = group.key === todayStr
        return (
          <div key={group.key} className="p-4">
            <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
              {group.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="space-y-1.5">
              {group.items.map(item => {
                if (item.kind === 'task') {
                  return (
                    <TaskPill
                      key={item.occ.occurrenceKey}
                      occurrence={item.occ}
                      onClick={onTaskClick}
                      onToggle={onTaskToggle}
                      showTime
                      locale={locale}
                    />
                  )
                }
                const o = item.occ
                return (
                  <button
                    key={o.occurrenceKey}
                    onClick={() => onEventClick(o)}
                    className={`w-full text-left pl-3 pr-2 py-2 rounded border-l-[3px] bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${typeAccent[o.event.event_type]} ${o.isDeclined ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {o.start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {o.end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={`text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5 ${o.isDeclined ? 'line-through' : ''}`}>
                      {o.event.title}
                    </div>
                    {o.event.location && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {o.event.location}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
