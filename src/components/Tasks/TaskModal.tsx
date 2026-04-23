import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Users, Bell, Eye, Edit3, X as XIcon, Plus } from 'lucide-react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import SearchableSelect from '../ui/SearchableSelect'
import SegmentedControl from '../ui/SegmentedControl'
import ToggleSwitch from '../ui/ToggleSwitch'
import ParticipantPicker from '../Calendar/components/ParticipantPicker'
import MarkdownView from '../ui/MarkdownView'
import AttachmentList from './components/AttachmentList'
import {
  fetchProjectOptions,
  fetchTaskUsers,
  listTaskAttachments,
  type ProjectOption,
} from './services/tasksService'
import { useAuth } from '../../contexts/AuthContext'
import type {
  NewTaskInput,
  Task,
  TaskAttachment,
  TaskDescriptionFormat,
  TaskStatus,
  TaskUser,
  UpdateTaskInput,
} from '../../types/tasks'

interface Props {
  show: boolean
  task?: Task | null
  onClose: () => void
  onCreate?: (input: NewTaskInput) => Promise<void>
  onUpdate?: (patch: UpdateTaskInput, assigneeIds: string[]) => Promise<void>
}

const REMINDER_PRESETS: number[] = [5, 15, 60, 1440, 2880]

interface FormState {
  title: string
  description: string
  descriptionFormat: TaskDescriptionFormat
  status: TaskStatus
  projectId: string | null
  dueDate: string
  dueTime: string
  reminders: number[]
  isPrivate: boolean
  assigneeIds: string[]
}

function initialFromTask(task?: Task | null): FormState {
  if (!task) {
    return {
      title: '',
      description: '',
      descriptionFormat: 'markdown',
      status: 'todo',
      projectId: null,
      dueDate: '',
      dueTime: '',
      reminders: [],
      isPrivate: false,
      assigneeIds: [],
    }
  }
  return {
    title: task.title,
    description: task.description || '',
    descriptionFormat: task.description_format,
    status: task.status,
    projectId: task.project_id,
    dueDate: task.due_date || '',
    dueTime: task.due_time ? task.due_time.slice(0, 5) : '',
    reminders: [...task.reminder_offsets],
    isPrivate: task.is_private,
    assigneeIds: (task.assignees || []).map(a => a.user_id),
  }
}

function sameArray(a: number[] | string[], b: number[] | string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

const TaskModal: React.FC<Props> = ({ show, task, onClose, onCreate, onUpdate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isEdit = !!task

  const [form, setForm] = useState<FormState>(() => initialFromTask(task))
  const [original, setOriginal] = useState<FormState>(() => initialFromTask(task))
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])
  const [saving, setSaving] = useState(false)
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false)
  const [descTab, setDescTab] = useState<'edit' | 'preview'>('edit')
  const [customReminder, setCustomReminder] = useState('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show) return
    const next = initialFromTask(task)
    setForm(next)
    setOriginal(next)
    setDescTab('edit')
    setCustomReminder('')
    fetchProjectOptions().then(setProjects).catch(() => setProjects([]))
    fetchTaskUsers().then(setUsers).catch(() => setUsers([]))
    if (task?.id) {
      listTaskAttachments(task.id).then(setAttachments).catch(() => setAttachments([]))
    } else {
      setAttachments([])
    }
  }, [show, task])

  const dirty = useMemo(() => {
    return (
      form.title !== original.title ||
      form.description !== original.description ||
      form.descriptionFormat !== original.descriptionFormat ||
      form.status !== original.status ||
      form.projectId !== original.projectId ||
      form.dueDate !== original.dueDate ||
      form.dueTime !== original.dueTime ||
      form.isPrivate !== original.isPrivate ||
      !sameArray(form.reminders, original.reminders) ||
      !sameArray(form.assigneeIds.slice().sort(), original.assigneeIds.slice().sort())
    )
  }, [form, original])

  const projectOptions = useMemo(
    () => projects.map(p => ({ value: p.id, label: p.name })),
    [projects],
  )

  const tryClose = () => {
    if (!saving && dirty) {
      setShowConfirmDiscard(true)
      return
    }
    onClose()
  }

  const submit = async () => {
    if (!user || !form.title.trim()) return
    setSaving(true)
    try {
      if (isEdit && onUpdate) {
        const patch: UpdateTaskInput = {}
        if (form.title !== original.title) patch.title = form.title.trim()
        if (form.description !== original.description) patch.description = form.description
        if (form.descriptionFormat !== original.descriptionFormat)
          patch.description_format = form.descriptionFormat
        if (form.status !== original.status) patch.status = form.status
        if (form.projectId !== original.projectId) patch.project_id = form.projectId
        if (form.dueDate !== original.dueDate) patch.due_date = form.dueDate || null
        if (form.dueTime !== original.dueTime) patch.due_time = form.dueTime || null
        if (form.isPrivate !== original.isPrivate) patch.is_private = form.isPrivate
        if (!sameArray(form.reminders, original.reminders))
          patch.reminder_offsets = form.reminders
        await onUpdate(patch, form.isPrivate ? [] : form.assigneeIds)
      } else if (onCreate) {
        const input: NewTaskInput = {
          title: form.title.trim(),
          description: form.description,
          due_date: form.dueDate || null,
          due_time: form.dueTime || null,
          priority: 'normal',
          status: form.status,
          is_private: form.isPrivate,
          project_id: form.projectId,
          reminder_offsets: form.reminders,
          description_format: form.descriptionFormat,
          assignee_ids: form.isPrivate ? [] : form.assigneeIds,
        }
        await onCreate(input)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }

  const addReminder = (minutes: number) => {
    if (form.reminders.includes(minutes)) return
    setForm(f => ({ ...f, reminders: [...f.reminders, minutes].sort((a, b) => a - b) }))
  }

  const removeReminder = (minutes: number) => {
    setForm(f => ({ ...f, reminders: f.reminders.filter(m => m !== minutes) }))
  }

  const reminderLabel = (minutes: number): string => {
    if (REMINDER_PRESETS.includes(minutes)) {
      return t(`tasks.reminders.presets.${minutes}_min`)
    }
    if (minutes >= 1440 && minutes % 1440 === 0)
      return t('tasks.reminders.days_before', { count: minutes / 1440 })
    if (minutes >= 60 && minutes % 60 === 0)
      return t('tasks.reminders.hours_before', { count: minutes / 60 })
    return t('tasks.reminders.minutes_before', { count: minutes })
  }

  const addCustomReminder = () => {
    const n = parseInt(customReminder, 10)
    if (!Number.isFinite(n) || n <= 0) return
    addReminder(n)
    setCustomReminder('')
  }

  if (!show) return null

  return (
    <>
      <Modal show={show} onClose={tryClose} size="lg">
        <Modal.Header
          title={isEdit ? t('tasks.modal.edit_title') : t('tasks.modal.new_title')}
          onClose={tryClose}
        />
        <Modal.Body>
          <div ref={formRef} onKeyDown={handleKeyDown} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tasks.modal.title_label')}
              </label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tasks.modal.status_label')}
                </label>
                <SegmentedControl<TaskStatus>
                  value={form.status}
                  onChange={v => setForm(f => ({ ...f, status: v }))}
                  options={[
                    { value: 'todo', label: t('tasks.status.todo') },
                    { value: 'in_progress', label: t('tasks.status.in_progress') },
                    { value: 'done', label: t('tasks.status.done') },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tasks.modal.project_label')}
                </label>
                <SearchableSelect
                  value={form.projectId}
                  options={projectOptions}
                  onChange={v => setForm(f => ({ ...f, projectId: v }))}
                  placeholder={t('tasks.modal.project_placeholder')}
                  searchPlaceholder={t('tasks.modal.project_search_placeholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tasks.modal.due_date_label')}
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tasks.modal.due_time_label')}
                </label>
                <input
                  type="time"
                  value={form.dueTime}
                  onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Bell className="w-4 h-4" /> {t('tasks.modal.reminders_label')}
              </label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {form.reminders.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                  >
                    {reminderLabel(m)}
                    <button
                      type="button"
                      onClick={() => removeReminder(m)}
                      className="text-blue-700/70 hover:text-blue-900 dark:text-blue-200/70 dark:hover:text-blue-100"
                      aria-label={t('common.remove')}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {form.reminders.length === 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('tasks.reminders.none')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {REMINDER_PRESETS.map(m => {
                  const active = form.reminders.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => (active ? removeReminder(m) : addReminder(m))}
                      className={`px-2 py-0.5 text-xs rounded-full border ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {t(`tasks.reminders.presets.${m}_min`)}
                    </button>
                  )
                })}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={customReminder}
                    onChange={e => setCustomReminder(e.target.value)}
                    placeholder={t('tasks.reminders.custom_placeholder')}
                    className="w-24 px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={addCustomReminder}
                    disabled={!customReminder.trim()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    {t('tasks.reminders.custom_add')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <ToggleSwitch
                checked={form.isPrivate}
                onChange={v => setForm(f => ({ ...f, isPrivate: v }))}
                label={t('tasks.modal.private_label')}
                description={t('tasks.modal.private_description')}
              />
            </div>

            {!form.isPrivate && (
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Users className="w-4 h-4" /> {t('tasks.modal.assign_label')}
                </label>
                <ParticipantPicker
                  users={users}
                  selectedIds={form.assigneeIds}
                  onChange={ids => setForm(f => ({ ...f, assigneeIds: ids }))}
                  excludeId={user?.id}
                  placeholder={t('tasks.modal.assign_placeholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tasks.attachments.label')}
              </label>
              {isEdit && task ? (
                <AttachmentList
                  taskId={task.id}
                  attachments={attachments}
                  userId={user?.id || ''}
                  userRole={user?.role || ''}
                  canDelete={a => a.uploaded_by === user?.id || task.created_by === user?.id}
                  onChange={() => listTaskAttachments(task.id).then(setAttachments).catch(() => undefined)}
                />
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-gray-900/40 rounded">
                  {t('tasks.attachments.create_first')}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('tasks.modal.description_label')}
                </label>
                <SegmentedControl<'edit' | 'preview'>
                  size="sm"
                  value={descTab}
                  onChange={setDescTab}
                  options={[
                    { value: 'edit', label: t('tasks.modal.desc_edit'), icon: Edit3 },
                    { value: 'preview', label: t('tasks.modal.desc_preview'), icon: Eye },
                  ]}
                />
              </div>
              {descTab === 'edit' ? (
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={6}
                  placeholder={t('tasks.modal.description_placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                />
              ) : (
                <div className="min-h-[140px] px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                  {form.description.trim() ? (
                    <MarkdownView content={form.description} />
                  ) : (
                    <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                      {t('tasks.modal.description_empty_preview')}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {t('tasks.modal.description_hint')}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={tryClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.title.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving
              ? t('tasks.modal.saving')
              : isEdit
                ? t('tasks.modal.save_button')
                : t('tasks.modal.create_button')}
          </button>
        </Modal.Footer>
      </Modal>
      <ConfirmDialog
        show={showConfirmDiscard}
        title={t('tasks.modal.discard_title')}
        message={t('tasks.modal.discard_message')}
        variant="danger"
        confirmLabel={t('tasks.modal.discard_confirm')}
        onConfirm={() => {
          setShowConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setShowConfirmDiscard(false)}
      />
    </>
  )
}

export default TaskModal
