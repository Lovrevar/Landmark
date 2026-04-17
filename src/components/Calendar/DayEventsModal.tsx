import React, { useMemo } from 'react'
import { Clock, MapPin } from 'lucide-react'
import Modal from '../ui/Modal'
import type { CalendarEvent, EventType } from '../../types/tasks'

interface Props {
  date: Date | null
  events: CalendarEvent[]
  onClose: () => void
  onEventClick: (event: CalendarEvent) => void
}

const typeBg: Record<EventType, string> = {
  meeting: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  personal: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
  deadline: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200 border-red-200 dark:border-red-800',
  reminder: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
}

const typeLabel: Record<EventType, string> = {
  meeting: 'Sastanak',
  personal: 'Osobno',
  deadline: 'Rok',
  reminder: 'Podsjetnik',
}

const DayEventsModal: React.FC<Props> = ({ date, events, onClose, onEventClick }) => {
  const dayEvents = useMemo(() => {
    if (!date) return []
    const key = date.toDateString()
    return events
      .filter(e => new Date(e.start_at).toDateString() === key)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
  }, [date, events])

  if (!date) return null

  const title = date.toLocaleDateString('hr-HR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Modal show={!!date} onClose={onClose} size="md">
      <Modal.Header title={title} subtitle={`${dayEvents.length} dogadaj(a)`} onClose={onClose} />
      <Modal.Body>
        {dayEvents.length === 0 ? (
          <div className="py-10 text-center">
            <Clock className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Nema dogadaja na ovaj dan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(e => (
              <button
                key={e.id}
                onClick={() => onEventClick(e)}
                className={`w-full text-left border rounded-lg p-3 hover:shadow-md transition-shadow ${typeBg[e.event_type]}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    {typeLabel[e.event_type]}
                  </span>
                  <span className="text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(e.start_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(e.end_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="font-semibold text-sm">{e.title}</div>
                {e.location && (
                  <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {e.location}
                  </div>
                )}
                {e.description && (
                  <div className="text-xs opacity-75 mt-1 line-clamp-2">{e.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          Zatvori
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default DayEventsModal
