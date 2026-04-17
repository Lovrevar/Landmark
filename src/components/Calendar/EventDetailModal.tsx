import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Users, Lock, Check, X, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import type { CalendarEvent, EventResponse, EventType } from '../../types/tasks'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  event: CalendarEvent | null
  onClose: () => void
  onRespond: (
    participantId: string,
    response: EventResponse,
    eventId?: string,
    eventTitle?: string,
  ) => Promise<void>
  onDelete: (eventId: string, eventTitle?: string) => Promise<void>
  onChanged: () => void
}

const typeColor: Record<EventType, string> = {
  meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  personal: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  deadline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  reminder: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const EventDetailModal: React.FC<Props> = ({ event, onClose, onRespond, onDelete, onChanged }) => {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'

  if (!event) return null

  const me = event.participants?.find(p => p.user_id === user?.id)
  const isCreator = event.created_by === user?.id
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })

  const rsvp = async (response: EventResponse) => {
    if (!me) return
    await onRespond(me.id, response, event.id, event.title)
    onChanged()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(event.id, event.title)
      setShowConfirmDelete(false)
      onChanged()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal show={!!event} onClose={onClose} size="md">
        <Modal.Header title={event.title} onClose={onClose} />
        <Modal.Body>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 text-xs rounded ${typeColor[event.event_type]}`}>{t(`calendar.event_type.${event.event_type}`)}</span>
            {event.is_private && <span className="text-xs text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" /> {t('calendar.detail.private_badge')}</span>}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <div><span className="text-gray-500 dark:text-gray-400">{t('calendar.detail.start')}:</span> {fmt(event.start_at)}</div>
            <div><span className="text-gray-500 dark:text-gray-400">{t('calendar.detail.end')}:</span> {fmt(event.end_at)}</div>
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
            {t('calendar.detail.created_by')}: {event.creator?.username || t('chat.unknown_user')}
          </div>
          {event.participants && event.participants.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Users className="w-4 h-4" /> {t('calendar.detail.participants')}
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
                      {p.response === 'accepted' ? t('calendar.response.accepted') : p.response === 'declined' ? t('calendar.response.declined') : t('calendar.response.pending')}
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
                <Check className="w-4 h-4" /> {t('calendar.detail.accept')}
              </button>
              <button onClick={() => rsvp('declined')}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg ${me.response === 'declined' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'}`}>
                <X className="w-4 h-4" /> {t('calendar.detail.decline')}
              </button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {isCreator && (
            <button onClick={() => setShowConfirmDelete(true)} className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
              <Trash2 className="w-4 h-4" /> {t('calendar.detail.delete')}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{t('common.close')}</button>
        </Modal.Footer>
      </Modal>
      <ConfirmDialog
        show={showConfirmDelete}
        title={t('calendar.detail.delete_confirm_title')}
        message={t('calendar.detail.delete_confirm_message')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </>
  )
}

export default EventDetailModal
