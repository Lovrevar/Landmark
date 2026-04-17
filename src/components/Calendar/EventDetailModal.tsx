import React from 'react'
import { MapPin, Users, Lock, Check, X, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import type { CalendarEvent, EventType } from '../../types/tasks'
import { respondToEvent, deleteEvent } from './services/calendarService'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  event: CalendarEvent | null
  onClose: () => void
  onChanged: () => void
}

const typeColor: Record<EventType, string> = {
  meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  personal: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  deadline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  reminder: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const typeLabel: Record<EventType, string> = {
  meeting: 'Sastanak',
  personal: 'Osobno',
  deadline: 'Rok',
  reminder: 'Podsjetnik',
}

const fmt = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('hr-HR', { dateStyle: 'medium', timeStyle: 'short' })
}

const EventDetailModal: React.FC<Props> = ({ event, onClose, onChanged }) => {
  const { user } = useAuth()
  if (!event) return null

  const me = event.participants?.find(p => p.user_id === user?.id)
  const isCreator = event.created_by === user?.id

  const rsvp = async (response: 'accepted' | 'declined') => {
    if (!me) return
    await respondToEvent(me.id, response)
    onChanged()
  }

  const del = async () => {
    if (!confirm('Obrisati dogadaj?')) return
    await deleteEvent(event.id)
    onChanged()
    onClose()
  }

  return (
    <Modal show={!!event} onClose={onClose} size="md">
      <Modal.Header title={event.title} onClose={onClose} />
      <Modal.Body>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-1 text-xs rounded ${typeColor[event.event_type]}`}>{typeLabel[event.event_type]}</span>
          {event.is_private && <span className="text-xs text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Privatno</span>}
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <div><span className="text-gray-500 dark:text-gray-400">Pocetak:</span> {fmt(event.start_at)}</div>
          <div><span className="text-gray-500 dark:text-gray-400">Kraj:</span> {fmt(event.end_at)}</div>
        </div>
        {event.location && (
          <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <MapPin className="w-4 h-4 text-gray-500" /> {event.location}
          </div>
        )}
        {event.description && (
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</div>
        )}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Kreirao: {event.creator?.username || 'Nepoznato'}
        </div>
        {event.participants && event.participants.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" /> Sudionici
            </h4>
            <div className="space-y-1">
              {event.participants.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-900 dark:text-gray-100">{p.user?.username}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    p.response === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : p.response === 'declined' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {p.response === 'accepted' ? 'Prihvatio' : p.response === 'declined' ? 'Odbio' : 'Ceka odgovor'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {me && !isCreator && (
          <div className="flex gap-2 pt-2">
            <button onClick={() => rsvp('accepted')}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg ${me.response === 'accepted' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'}`}>
              <Check className="w-4 h-4" /> Prihvacam
            </button>
            <button onClick={() => rsvp('declined')}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg ${me.response === 'declined' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'}`}>
              <X className="w-4 h-4" /> Odbijam
            </button>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {isCreator && (
          <button onClick={del} className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
            <Trash2 className="w-4 h-4" /> Obrisi
          </button>
        )}
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Zatvori</button>
      </Modal.Footer>
    </Modal>
  )
}

export default EventDetailModal
