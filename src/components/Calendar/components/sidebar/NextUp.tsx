import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, MapPin, Repeat, Users } from 'lucide-react'
import type { EventType } from '../../../../types/tasks'
import type { ExpandedOccurrence } from '../../utils/recurrence'
import type { TaskOccurrence } from '../../utils/expandTasks'
import { relativeLabel } from '../../utils/relativeLabel'
import TaskPill from '../TaskPill'

interface Props {
  occurrences: ExpandedOccurrence[]
  taskOccurrences?: TaskOccurrence[]
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onTaskClick?: (occurrence: TaskOccurrence) => void
  limit?: number
}

type Item =
  | { kind: 'event'; occ: ExpandedOccurrence; sortAt: number }
  | { kind: 'task'; occ: TaskOccurrence; sortAt: number }

const typeDot: Record<EventType, string> = {
  meeting: 'bg-blue-500',
  personal: 'bg-gray-400',
  deadline: 'bg-red-500',
  reminder: 'bg-amber-500',
}

export default function NextUp({
  occurrences,
  taskOccurrences = [],
  onEventClick,
  onTaskClick,
  limit = 6,
}: Props) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'

  const items = useMemo<Item[]>(() => {
    const now = Date.now()
    const horizon = now + 24 * 60 * 60 * 1000
    const events: Item[] = occurrences
      .filter(o => o.start.getTime() > now - 5 * 60000)
      .map(o => ({ kind: 'event' as const, occ: o, sortAt: o.start.getTime() }))
    const tasks: Item[] = taskOccurrences
      .filter(o => o.due_at.getTime() > now - 5 * 60000 && o.due_at.getTime() <= horizon)
      .map(o => ({ kind: 'task' as const, occ: o, sortAt: o.due_at.getTime() }))
    return [...events, ...tasks].sort((a, b) => a.sortAt - b.sortAt).slice(0, limit)
  }, [occurrences, taskOccurrences, limit])

  const now = new Date()

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        {t('calendar.next_up.title')}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('calendar.next_up.empty')}</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            if (item.kind === 'task') {
              return (
                <TaskPill
                  key={item.occ.occurrenceKey}
                  occurrence={item.occ}
                  onClick={onTaskClick}
                  showTime
                  locale={dateLocale}
                />
              )
            }
            const o = item.occ
            const ev = o.event
            const participantCount = ev.participants?.length ?? 0
            return (
              <button
                key={o.occurrenceKey}
                type="button"
                onClick={() => onEventClick(o)}
                className={`w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${o.isDeclined ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${typeDot[ev.event_type]}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium text-gray-900 dark:text-gray-100 truncate ${o.isDeclined ? 'line-through' : ''}`}>
                      {ev.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {relativeLabel(o.start, now, t)}
                      <span className="mx-1.5">·</span>
                      {o.start.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                      {', '}
                      {o.start.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {(ev.recurrence || ev.location || participantCount > 0) && (
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        {ev.recurrence && <Repeat className="w-3 h-3" />}
                        {ev.location && (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{ev.location}</span>
                          </span>
                        )}
                        {participantCount > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Users className="w-3 h-3" /> {participantCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
