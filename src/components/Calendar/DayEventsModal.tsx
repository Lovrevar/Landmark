import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, MapPin } from 'lucide-react'
import Modal from '../ui/Modal'
import type { EventType } from '../../types/tasks'
import type { ExpandedOccurrence } from './utils/recurrence'
import type { TaskOccurrence } from './utils/expandTasks'
import TaskPill from './components/TaskPill'

interface Props {
  date: Date | null
  occurrences: ExpandedOccurrence[]
  taskOccurrences?: TaskOccurrence[]
  onClose: () => void
  onEventClick: (occurrence: ExpandedOccurrence) => void
  onTaskClick?: (occurrence: TaskOccurrence) => void
}

const typeBg: Record<EventType, string> = {
  meeting: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  personal: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
  deadline: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200 border-red-200 dark:border-red-800',
  reminder: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
}

const DayEventsModal: React.FC<Props> = ({
  date,
  occurrences,
  taskOccurrences = [],
  onClose,
  onEventClick,
  onTaskClick,
}) => {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'

  const dayOccurrences = useMemo(() => {
    if (!date) return []
    const key = date.toDateString()
    return occurrences
      .filter(o => o.start.toDateString() === key)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [date, occurrences])

  const dayTasks = useMemo(() => {
    if (!date) return []
    const key = date.toDateString()
    return taskOccurrences
      .filter(o => o.due_at.toDateString() === key)
      .sort((a, b) => a.due_at.getTime() - b.due_at.getTime())
  }, [date, taskOccurrences])

  if (!date) return null

  const title = date.toLocaleDateString(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Modal show={!!date} onClose={onClose} size="md">
      <Modal.Header title={title} subtitle={t('calendar.events_for_day', { count: dayOccurrences.length })} onClose={onClose} />
      <Modal.Body>
        {dayOccurrences.length === 0 && dayTasks.length === 0 ? (
          <div className="py-10 text-center">
            <Clock className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('calendar.no_events_day')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayTasks.length > 0 && (
              <div className="space-y-1.5 pb-2 border-b border-gray-200 dark:border-gray-700">
                {dayTasks.map(o => (
                  <TaskPill
                    key={o.occurrenceKey}
                    occurrence={o}
                    onClick={onTaskClick}
                    showTime
                    locale={dateLocale}
                  />
                ))}
              </div>
            )}
            {dayOccurrences.map(o => (
              <button
                key={o.occurrenceKey}
                onClick={() => onEventClick(o)}
                className={`w-full text-left border rounded-lg p-3 hover:shadow-md transition-shadow ${typeBg[o.event.event_type]} ${o.isDeclined ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    {t(`calendar.event_type.${o.event.event_type}`)}
                  </span>
                  <span className="text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {o.start.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {o.end.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`font-semibold text-sm ${o.isDeclined ? 'line-through' : ''}`}>{o.event.title}</div>
                {o.event.location && (
                  <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {o.event.location}
                  </div>
                )}
                {o.event.description && (
                  <div className="text-xs opacity-75 mt-1 line-clamp-2">{o.event.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          {t('common.close')}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default DayEventsModal
