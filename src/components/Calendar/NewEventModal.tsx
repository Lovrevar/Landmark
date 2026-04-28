import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Briefcase, Lock, MapPin, Plus, Repeat, Users, X } from 'lucide-react'
import Modal from '../ui/Modal'
import ToggleSwitch from '../ui/ToggleSwitch'
import SearchableSelect from '../ui/SearchableSelect'
import { fetchTaskUsers } from '../Tasks/services/tasksService'
import { fetchProjectOptions, type ProjectOption } from './services/calendarService'
import ParticipantPicker from './components/ParticipantPicker'
import type { NewEventInput, EventType, TaskUser } from '../../types/tasks'
import { useAuth } from '../../contexts/AuthContext'
import {
  DEFAULT_RECURRENCE,
  serializeRecurrence,
  type RecurrencePreset,
  type RecurrenceEndKind,
  type RecurrenceState,
} from './utils/recurrencePresets'

interface Props {
  show: boolean
  onClose: () => void
  onCreate: (input: NewEventInput) => Promise<void>
  defaultDate?: string
  defaultStartTime?: string
  defaultEndTime?: string
}

const eventTypeColors: Record<EventType, string> = {
  meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  personal: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  deadline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  reminder: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const eventTypeOrder: EventType[] = ['meeting', 'personal', 'deadline', 'reminder']

const REMINDER_PRESETS: number[] = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]

function formatReminderOffset(minutes: number, t: (k: string, v?: Record<string, unknown>) => string): string {
  if (minutes === 0) return t('calendar.modal.reminder.at_time')
  if (minutes < 60) return t('calendar.modal.reminder.minutes', { count: minutes })
  if (minutes < 1440) return t('calendar.modal.reminder.hours', { count: minutes / 60 })
  if (minutes < 10080) return t('calendar.modal.reminder.days', { count: minutes / 1440 })
  return t('calendar.modal.reminder.weeks', { count: minutes / 10080 })
}

function formatYmd(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const CUSTOM_WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const NewEventModal: React.FC<Props> = ({ show, onClose, onCreate, defaultDate, defaultStartTime, defaultEndTime }) => {
  const { t } = useTranslation()
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
  const [busy, setBusy] = useState(true)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([])
  const [recurrence, setRecurrence] = useState<RecurrenceState>(DEFAULT_RECURRENCE)
  const [users, setUsers] = useState<TaskUser[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!show) return
    Promise.all([
      fetchTaskUsers().then(setUsers).catch(() => setUsers([])),
      fetchProjectOptions().then(setProjects).catch(() => setProjects([])),
    ])
    const today = new Date()
    const nextDate = defaultDate || formatYmd(today)
    setTitle('')
    setDescription('')
    setLocation('')
    setDate(nextDate)
    setStartTime(defaultStartTime || '09:00')
    setEndTime(defaultEndTime || '10:00')
    setEventType('meeting')
    setIsPrivate(false)
    setParticipants([])
    setBusy(true)
    setProjectId(null)
    setReminderOffsets([])
    setRecurrence({ ...DEFAULT_RECURRENCE, endDate: nextDate })
    setError(null)
  }, [show, defaultDate, defaultStartTime, defaultEndTime])

  const timesValid = useMemo(() => {
    if (!date || !startTime || !endTime) return false
    return `${date}T${endTime}` > `${date}T${startTime}`
  }, [date, startTime, endTime])

  const canSave = useMemo(() => {
    if (!title.trim() || !date || !timesValid) return false
    if (recurrence.preset !== 'none' && recurrence.endKind === 'on' && !recurrence.endDate) return false
    return true
  }, [title, date, timesValid, recurrence])

  const addReminder = (minutes: number) => {
    if (reminderOffsets.includes(minutes)) return
    setReminderOffsets(prev => [...prev, minutes].sort((a, b) => a - b))
  }
  const removeReminder = (minutes: number) => {
    setReminderOffsets(prev => prev.filter(x => x !== minutes))
  }

  const availableReminderPresets = REMINDER_PRESETS.filter(m => !reminderOffsets.includes(m))

  const projectOptions = useMemo(
    () => projects.map(p => ({ value: p.id, label: p.name })),
    [projects],
  )

  const updateRecurrence = <K extends keyof RecurrenceState>(key: K, value: RecurrenceState[K]) => {
    setRecurrence(prev => ({ ...prev, [key]: value }))
  }

  const toggleCustomWeekday = (idx: number) => {
    setRecurrence(prev => {
      const has = prev.customByWeekday.includes(idx)
      return {
        ...prev,
        customByWeekday: has
          ? prev.customByWeekday.filter(x => x !== idx)
          : [...prev.customByWeekday, idx].sort((a, b) => a - b),
      }
    })
  }

  const submit = async () => {
    if (!user || !canSave) return
    const startAt = new Date(`${date}T${startTime}:00`).toISOString()
    const endAt = new Date(`${date}T${endTime}:00`).toISOString()
    const rruleString = serializeRecurrence(recurrence, new Date(`${date}T${startTime}:00`))
    setSaving(true)
    setError(null)
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
        project_id: projectId,
        recurrence: rruleString,
        reminder_offsets: reminderOffsets,
        busy,
      }
      await onCreate(input)
      onClose()
    } catch (e) {
      console.error('Failed to create calendar event', e)
      const message = (e as { message?: string })?.message
      setError(message || t('calendar.modal.error_generic'))
    } finally {
      setSaving(false)
    }
  }

  const presetOptions: RecurrencePreset[] = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom']
  const endKindOptions: RecurrenceEndKind[] = ['never', 'on', 'after']

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header title={t('calendar.modal.new_title')} onClose={onClose} />
      <Modal.Body>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('calendar.modal.title_label')} <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('calendar.modal.description_label')}
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <MapPin className="w-4 h-4" /> {t('calendar.modal.location_label')}
          </label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calendar.modal.date_label')}
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calendar.modal.start_time_label')}
            </label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className={[
                'w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100',
                !timesValid ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600',
              ].join(' ')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calendar.modal.end_time_label')}
            </label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className={[
                'w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100',
                !timesValid ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600',
              ].join(' ')}
            />
          </div>
        </div>
        {!timesValid && (
          <p className="text-xs text-red-600 dark:text-red-400 -mt-2">
            {t('calendar.modal.end_before_start')}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('calendar.modal.type_label')}
          </label>
          <div className="flex flex-wrap gap-2">
            {eventTypeOrder.map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setEventType(value)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${eventType === value ? 'border-blue-500' : 'border-transparent'} ${eventTypeColors[value]}`}
              >
                {t(`calendar.event_type.${value}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Repeat className="w-4 h-4" /> {t('calendar.modal.recurrence.label')}
          </label>
          <div className="flex flex-wrap gap-2">
            {presetOptions.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => updateRecurrence('preset', p)}
                className={[
                  'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                  recurrence.preset === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600',
                ].join(' ')}
              >
                {t(`calendar.modal.recurrence.preset.${p}`)}
              </button>
            ))}
          </div>

          {recurrence.preset === 'custom' && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <span>{t('calendar.modal.recurrence.every')}</span>
                <input
                  type="number"
                  min={1}
                  value={recurrence.customInterval}
                  onChange={e => updateRecurrence('customInterval', Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                />
                <select
                  value={recurrence.customFreq}
                  onChange={e => updateRecurrence('customFreq', e.target.value as RecurrenceState['customFreq'])}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="daily">{t('calendar.modal.recurrence.freq.daily')}</option>
                  <option value="weekly">{t('calendar.modal.recurrence.freq.weekly')}</option>
                  <option value="monthly">{t('calendar.modal.recurrence.freq.monthly')}</option>
                </select>
              </div>
              {recurrence.customFreq === 'weekly' && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('calendar.modal.recurrence.on_days')}
                  </div>
                  <div className="flex gap-1">
                    {CUSTOM_WEEKDAY_KEYS.map((key, idx) => {
                      const active = recurrence.customByWeekday.includes(idx)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleCustomWeekday(idx)}
                          className={[
                            'w-8 h-8 text-xs rounded-full border font-medium',
                            active
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200',
                          ].join(' ')}
                        >
                          {t(`calendar.day_names.${key}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {recurrence.preset !== 'none' && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('calendar.modal.recurrence.ends')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {endKindOptions.map(kind => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => updateRecurrence('endKind', kind)}
                    className={[
                      'px-3 py-1.5 text-sm rounded-lg border',
                      recurrence.endKind === kind
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200',
                    ].join(' ')}
                  >
                    {t(`calendar.modal.recurrence.end.${kind}`)}
                  </button>
                ))}
                {recurrence.endKind === 'on' && (
                  <input
                    type="date"
                    value={recurrence.endDate}
                    onChange={e => updateRecurrence('endDate', e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                )}
                {recurrence.endKind === 'after' && (
                  <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="number"
                      min={1}
                      value={recurrence.endCount}
                      onChange={e => updateRecurrence('endCount', Math.max(1, parseInt(e.target.value || '1', 10)))}
                      className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                    <span>{t('calendar.modal.recurrence.occurrences')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Bell className="w-4 h-4" /> {t('calendar.modal.reminders.label')}
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {reminderOffsets.map(m => (
              <span
                key={m}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {formatReminderOffset(m, t)}
                <button
                  type="button"
                  onClick={() => removeReminder(m)}
                  className="text-blue-700/70 hover:text-blue-900 dark:text-blue-200/70 dark:hover:text-blue-100"
                  aria-label={t('calendar.modal.reminders.remove')}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {availableReminderPresets.length > 0 && (
              <select
                value=""
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (!Number.isNaN(v)) addReminder(v)
                }}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                <option value="">{t('calendar.modal.reminders.add')}</option>
                {availableReminderPresets.map(m => (
                  <option key={m} value={m}>{formatReminderOffset(m, t)}</option>
                ))}
              </select>
            )}
            {reminderOffsets.length === 0 && availableReminderPresets.length === 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('calendar.modal.reminders.none')}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Briefcase className="w-4 h-4" /> {t('calendar.modal.project_label')}
            </label>
            <SearchableSelect
              value={projectId}
              options={projectOptions}
              onChange={setProjectId}
              placeholder={t('calendar.modal.project_placeholder')}
              searchPlaceholder={t('common.search')}
            />
          </div>
          <div className="flex items-end">
            <ToggleSwitch
              checked={busy}
              onChange={setBusy}
              label={busy ? t('calendar.modal.busy_label') : t('calendar.modal.free_label')}
              description={t('calendar.modal.busy_description')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="eventPrivate"
            type="checkbox"
            checked={isPrivate}
            onChange={e => setIsPrivate(e.target.checked)}
          />
          <label htmlFor="eventPrivate" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Lock className="w-4 h-4" /> {t('calendar.modal.private_label')}
          </label>
        </div>

        {!isPrivate && (
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Users className="w-4 h-4" /> {t('calendar.modal.participants_label')}
            </label>
            <ParticipantPicker
              users={users}
              selectedIds={participants}
              onChange={setParticipants}
              excludeId={user?.id ?? null}
              placeholder={t('calendar.modal.participant_placeholder')}
            />
          </div>
        )}

        {error && (
          <div className="px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={submit}
          disabled={saving || !canSave}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          {saving ? t('calendar.modal.saving') : t('calendar.modal.create_button')}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default NewEventModal
