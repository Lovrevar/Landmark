import React, { useEffect, useState } from 'react'
import { Lock, Users, MapPin } from 'lucide-react'
import Modal from '../ui/Modal'
import { createEvent } from './services/calendarService'
import { fetchTaskUsers } from '../Tasks/services/tasksService'
import type { NewEventInput, EventType, TaskUser } from '../../types/tasks'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  show: boolean
  onClose: () => void
  onCreated: () => void
  defaultDate?: string
}

const eventTypes: { value: EventType; label: string; color: string }[] = [
  { value: 'meeting', label: 'Sastanak', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'personal', label: 'Osobno', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'deadline', label: 'Rok', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'reminder', label: 'Podsjetnik', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
]

const NewEventModal: React.FC<Props> = ({ show, onClose, onCreated, defaultDate }) => {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [eventType, setEventType] = useState<EventType>('meeting')
  const [isPrivate, setIsPrivate] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (show) {
      fetchTaskUsers().then(setUsers).catch(() => setUsers([]))
      setTitle(''); setDescription(''); setLocation('')
      setDate(defaultDate || new Date().toISOString().slice(0, 10))
      setStartTime('09:00'); setEndTime('10:00')
      setEventType('meeting'); setIsPrivate(false); setParticipants([])
    }
  }, [show, defaultDate])

  const toggle = (id: string) => {
    setParticipants(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  const submit = async () => {
    if (!user || !title.trim() || !date) return
    const startAt = new Date(`${date}T${startTime}:00`).toISOString()
    const endAt = new Date(`${date}T${endTime}:00`).toISOString()
    setSaving(true)
    try {
      const input: NewEventInput = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        start_at: startAt,
        end_at: endAt,
        event_type: eventType,
        is_private: isPrivate,
        all_day: false,
        participant_ids: isPrivate ? [] : participants,
      }
      await createEvent(input, user.id)
      onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} size="md">
      <Modal.Header title="Novi dogadaj" onClose={onClose} />
      <Modal.Body>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Naslov</label>
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opis</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> Lokacija
          </label>
          <input value={location} onChange={e => setLocation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Od</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Do</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tip</label>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map(e => (
              <button key={e.value} type="button" onClick={() => setEventType(e.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${eventType === e.value ? 'border-blue-500' : 'border-transparent'} ${e.color}`}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input id="eventPrivate" type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
          <label htmlFor="eventPrivate" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Lock className="w-4 h-4" /> Privatno (samo ja vidim)
          </label>
        </div>
        {!isPrivate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Users className="w-4 h-4" /> Sudionici
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
              {users.filter(u => u.id !== user?.id).map(u => (
                <button key={u.id} type="button" onClick={() => toggle(u.id)}
                  className={`w-full px-3 py-2 text-left flex justify-between items-center text-sm ${participants.includes(u.id) ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <span className="text-gray-900 dark:text-gray-100">{u.username}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Odustani</button>
        <button onClick={submit} disabled={saving || !title.trim() || !date}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
          {saving ? 'Spremanje...' : 'Kreiraj dogadaj'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default NewEventModal
