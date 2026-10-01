import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MapPin,
  Users,
  Lock,
  Check,
  X,
  Trash2,
  Repeat,
  Bell,
  Briefcase,
  CircleDot,
  Circle,
  Edit2,
} from 'lucide-react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import type { CalendarEvent, EventResponse, NewEventInput } from '../../types/tasks'
import type { ExpandedOccurrence } from './utils/recurrence'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  createException,
  respondToOccurrence,
  updateEventWithParticipants,
} from './services/calendarService'
import type { ProjectOption } from './services/calendarService'
import NewEventModal from './NewEventModal'
import { EVENT_TYPE_COLORS } from './utils/eventTypeColors'
import { intlLocale } from '../../utils/locale'

interface Props {
  occurrence: ExpandedOccurrence | null
  /**
   * The stored event behind `occurrence`, which is what the edit form loads. An occurrence with
   * a title override carries a copy of the event under that title, and saving the copy would
   * rename the whole series. Falls back to `occurrence.event` when not given.
   */
  sourceEvent?: CalendarEvent | null
  projects?: ProjectOption[]
  /** `projects` is empty because the fetch failed, not because there are none. */
  projectsLoadFailed?: boolean
  onClose: () => void
  onRespond: (
    participantId: string,
    response: EventResponse,
    eventId?: string,
    eventTitle?: string,
  ) => Promise<void>
  onDelete: (eventId: string, eventTitle?: string) => Promise<void>
  /** Refetch after a change. Awaited after an edit, so the detail re-opens on fresh data. */
  onChanged: () => void | Promise<void>
}

type DeleteScope = 'single' | 'series'

const EventDetailModal: React.FC<Props> = ({
  occurrence,
  sourceEvent,
  projects,
  projectsLoadFailed = false,
  onClose,
  onRespond,
  onDelete,
  onChanged,
}) => {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const [confirmScope, setConfirmScope] = useState<DeleteScope | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [responding, setResponding] = useState(false)
  const [editing, setEditing] = useState(false)
  const dateLocale = intlLocale(i18n.language)

  const event = occurrence?.event ?? null

  const projectName = useMemo(() => {
    if (!event?.project_id || !projects) return null
    const name = projects.find(p => p.id === event.project_id)?.name
    if (name) return name
    // The event has a project but the list could not be fetched. Dropping the row entirely
    // reads as "not linked to a project", which is the opposite of what is stored.
    return projectsLoadFailed ? t('common.option_name_unavailable') : null
  }, [event?.project_id, projects, projectsLoadFailed, t])

  // Closing the detail (or the occurrence disappearing) ends any edit in progress.
  useEffect(() => {
    if (!occurrence) setEditing(false)
  }, [occurrence])

  // Swapping between the detail and the edit form flips two Modal scroll locks in one commit,
  // and whichever Modal's effect runs last decides whether the page behind can scroll. This
  // effect belongs to the parent of both, so it runs after them and keeps the lock on.
  const open = !!occurrence
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    // Only the swap needs correcting; opening and closing are handled by Modal itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!occurrence || !event) return null

  const editSource = sourceEvent && sourceEvent.id === event.id ? sourceEvent : event

  const me = event.participants?.find(p => p.user_id === user?.id)
  const isCreator = event.created_by === user?.id
  const isRecurring = !!event.recurrence
  const originalStartIso = occurrence.originalStartIso
  const myResponse = occurrence.myResponse

  const fmt = (iso: string | Date) =>
    new Date(iso).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })

  const respondThis = async (response: EventResponse) => {
    if (!user) return
    setResponding(true)
    try {
      await respondToOccurrence(event.id, user.id, originalStartIso, response, event.title)
      onChanged()
      onClose()
    } catch (e) {
      console.error('Failed to respond to calendar occurrence', e)
      toast.error(t('calendar.detail.respond_failed'))
    } finally {
      setResponding(false)
    }
  }

  const respondSeries = async (response: EventResponse) => {
    if (!me) return
    setResponding(true)
    try {
      await onRespond(me.id, response, event.id, event.title)
      onChanged()
      onClose()
    } catch (e) {
      console.error('Failed to respond to calendar event', e)
      toast.error(t('calendar.detail.respond_failed'))
    } finally {
      setResponding(false)
    }
  }

  const handleDeleteClick = () => {
    setConfirmScope(isRecurring ? 'single' : 'series')
  }

  const confirmDelete = async () => {
    if (!confirmScope) return
    setDeleting(true)
    try {
      if (confirmScope === 'single') {
        await createException(
          event.id,
          originalStartIso,
          { is_cancelled: true },
          event.title,
        )
      } else {
        await onDelete(event.id, event.title)
      }
      setConfirmScope(null)
      onChanged()
      onClose()
    } catch (e) {
      console.error('Failed to delete calendar event', e)
      setConfirmScope(null)
      toast.error(t('calendar.detail.delete_failed'))
    } finally {
      setDeleting(false)
    }
  }

  // Errors propagate to the form, which shows them inline and stays open.
  const saveEdit = async (input: NewEventInput) => {
    await updateEventWithParticipants(editSource.id, input, editSource)
    await onChanged()
  }

  const reminderLabel = (minutes: number): string => {
    if (minutes === 0) return t('calendar.modal.reminder.at_time')
    if (minutes < 60) return t('calendar.modal.reminder.minutes', { count: minutes })
    if (minutes < 60 * 24) return t('calendar.modal.reminder.hours', { count: Math.round(minutes / 60) })
    return t('calendar.modal.reminder.days', { count: Math.round(minutes / 1440) })
  }

  const responsePill = (response: EventResponse) => (
    <span
      className={`text-xs px-2 py-0.5 rounded ${
        response === 'accepted'
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
          : response === 'declined'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
      }`}
    >
      {response === 'accepted'
        ? t('calendar.response.accepted')
        : response === 'declined'
        ? t('calendar.response.declined')
        : t('calendar.response.pending')}
    </span>
  )

  return (
    <>
      <NewEventModal
        show={editing}
        event={editSource}
        onSave={saveEdit}
        onClose={() => setEditing(false)}
      />
      <Modal show={!!occurrence && !editing} onClose={onClose} size="md">
        <Modal.Header title={event.title} onClose={onClose} />
        <Modal.Body>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 text-xs rounded ${EVENT_TYPE_COLORS[event.event_type].badge}`}>
              {t(`calendar.event_type.${event.event_type}`)}
            </span>
            {event.is_private && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> {t('calendar.detail.private_badge')}
              </span>
            )}
            {isRecurring && (
              <span className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded flex items-center gap-1">
                <Repeat className="w-3 h-3" /> {t('calendar.detail.recurring')}
              </span>
            )}
            <span className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
              {event.busy ? <CircleDot className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              {event.busy ? t('calendar.modal.busy_label') : t('calendar.modal.free_label')}
            </span>
            {me && responsePill(myResponse)}
          </div>

          <div className="text-sm text-gray-700 dark:text-gray-300">
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('calendar.detail.start')}:</span>{' '}
              {fmt(occurrence.start)}
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('calendar.detail.end')}:</span>{' '}
              {fmt(occurrence.end)}
            </div>
          </div>

          {event.location && (
            <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-gray-500" /> {event.location}
            </div>
          )}

          {projectName && (
            <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Briefcase className="w-4 h-4 text-gray-500" /> {projectName}
            </div>
          )}

          {event.reminder_offsets && event.reminder_offsets.length > 0 && (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <Bell className="w-4 h-4" /> {t('calendar.detail.reminders')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {event.reminder_offsets.map(m => (
                  <span
                    key={m}
                    className="text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 px-2 py-0.5 rounded"
                  >
                    {reminderLabel(m)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {event.description}
            </div>
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
                    {responsePill(p.response)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {me && !isCreator && (
            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <button
                  disabled={responding}
                  onClick={() => respondThis('accepted')}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg disabled:opacity-60 ${
                    myResponse === 'accepted'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                  }`}
                >
                  <Check className="w-4 h-4" />{' '}
                  {isRecurring ? t('calendar.detail.accept_this') : t('calendar.detail.accept')}
                </button>
                <button
                  disabled={responding}
                  onClick={() => respondThis('declined')}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg disabled:opacity-60 ${
                    myResponse === 'declined'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  <X className="w-4 h-4" />{' '}
                  {isRecurring ? t('calendar.detail.decline_this') : t('calendar.detail.decline')}
                </button>
              </div>
              {isRecurring && (
                <div className="flex gap-2">
                  <button
                    disabled={responding}
                    onClick={() => respondSeries('accepted')}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                  >
                    <Check className="w-3 h-3" /> {t('calendar.detail.accept_series')}
                  </button>
                  <button
                    disabled={responding}
                    onClick={() => respondSeries('declined')}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                  >
                    <X className="w-3 h-3" /> {t('calendar.detail.decline_series')}
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {isCreator && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Edit2 className="w-4 h-4" /> {t('common.edit')}
              </button>
              {isRecurring && (
                <button
                  onClick={() => setConfirmScope('single')}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" /> {t('calendar.detail.delete_single')}
                </button>
              )}
              <button
                onClick={() => (isRecurring ? setConfirmScope('series') : handleDeleteClick())}
                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />{' '}
                {isRecurring ? t('calendar.detail.delete_series') : t('calendar.detail.delete')}
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {t('common.close')}
          </button>
        </Modal.Footer>
      </Modal>
      <ConfirmDialog
        show={confirmScope !== null}
        title={
          confirmScope === 'single'
            ? t('calendar.detail.delete_single_title')
            : t('calendar.detail.delete_confirm_title')
        }
        message={
          confirmScope === 'single'
            ? t('calendar.detail.delete_single_message')
            : t('calendar.detail.delete_confirm_message')
        }
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmScope(null)}
      />
    </>
  )
}

export default EventDetailModal
