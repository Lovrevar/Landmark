import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  X,
  Trash2,
  Edit2,
  Check,
  Activity,
  MessageSquare,
  Lock,
  Bell,
  FolderOpen,
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit3,
} from 'lucide-react'
import ConfirmDialog from '../ui/ConfirmDialog'
import SegmentedControl from '../ui/SegmentedControl'
import SearchableSelect from '../ui/SearchableSelect'
import ToggleSwitch from '../ui/ToggleSwitch'
import ParticipantPicker from '../Calendar/components/ParticipantPicker'
import MarkdownView from '../ui/MarkdownView'
import AvatarStack from '../ui/AvatarStack'
import AttachmentList from './components/AttachmentList'
import MentionPicker from './components/MentionPicker'
import { renderCommentWithMentions } from './components/mentions'
import { useTaskComments } from './hooks/useTaskComments'
import {
  fetchProjectOptions,
  fetchTaskActivity,
  fetchTaskUsers,
  listTaskAttachments,
  setAssignees,
  updateTask,
  type ProjectOption,
  type TaskActivityEntry,
} from './services/tasksService'
import { useAuth } from '../../contexts/AuthContext'
import type {
  Task,
  TaskAttachment,
  TaskStatus,
  TaskUser,
  UpdateTaskInput,
} from '../../types/tasks'

interface Props {
  task: Task | null
  onClose: () => void
  onDelete: (task: Task) => void
  onChanged: () => void
}

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'in_progress', 'done']

const TaskDetail: React.FC<Props> = ({ task, onClose, onDelete, onChanged }) => {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [descFormatDraft, setDescFormatDraft] = useState<'markdown' | 'plain'>('markdown')
  const [descPreview, setDescPreview] = useState<'edit' | 'preview'>('edit')
  const [editingAssignees, setEditingAssignees] = useState(false)
  const [assigneeDraft, setAssigneeDraft] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [activity, setActivity] = useState<TaskActivityEntry[]>([])
  const [activityExpanded, setActivityExpanded] = useState(false)
  const [tab, setTab] = useState<'activity' | 'comments'>('comments')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { comments, loading: commentsLoading, draft, setDraft, sending, send, remove, refresh } =
    useTaskComments(task?.id ?? null)

  const taskIdRef = useRef(task?.id)

  const loadAuxiliary = useCallback(async (taskId: string) => {
    const [atts, acts] = await Promise.all([
      listTaskAttachments(taskId).catch(() => []),
      fetchTaskActivity(taskId).catch(() => []),
    ])
    setAttachments(atts)
    setActivity(acts)
  }, [])

  useEffect(() => {
    setMounted(!!task)
    if (task) {
      taskIdRef.current = task.id
      setTitleDraft(task.title)
      setDescriptionDraft(task.description || '')
      setDescFormatDraft(task.description_format)
      setAssigneeDraft((task.assignees || []).map(a => a.user_id))
      setEditingTitle(false)
      setEditingDescription(false)
      setEditingAssignees(false)
      setActivityExpanded(false)
      setTab('comments')
      setDescPreview('edit')
      loadAuxiliary(task.id)
      fetchProjectOptions().then(setProjects).catch(() => setProjects([]))
      fetchTaskUsers().then(setUsers).catch(() => setUsers([]))
    }
  }, [task, loadAuxiliary])

  useEffect(() => {
    if (!task) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [task, onClose])

  const projectOptions = useMemo(
    () => projects.map(p => ({ value: p.id, label: p.name })),
    [projects],
  )

  if (!task || !user) return null

  const canEdit = task.created_by === user.id || (task.assignees || []).some(a => a.user_id === user.id)
  const canDelete = task.created_by === user.id

  const saveField = async (patch: UpdateTaskInput) => {
    setSaving(true)
    try {
      await updateTask(task.id, patch, user.id, user.role, task.title)
      onChanged()
      await loadAuxiliary(task.id)
    } finally {
      setSaving(false)
    }
  }

  const saveTitle = async () => {
    if (!titleDraft.trim() || titleDraft === task.title) {
      setEditingTitle(false)
      setTitleDraft(task.title)
      return
    }
    await saveField({ title: titleDraft.trim() })
    setEditingTitle(false)
  }

  const saveDescription = async () => {
    if (descriptionDraft === task.description && descFormatDraft === task.description_format) {
      setEditingDescription(false)
      return
    }
    await saveField({
      description: descriptionDraft,
      description_format: descFormatDraft,
    })
    setEditingDescription(false)
  }

  const saveStatus = async (next: TaskStatus) => {
    if (next === task.status) return
    await saveField({ status: next })
  }

  const saveProject = async (pid: string | null) => {
    if (pid === task.project_id) return
    await saveField({ project_id: pid })
  }

  const saveDueDate = async (value: string) => {
    if (value === (task.due_date || '')) return
    await saveField({ due_date: value || null })
  }

  const saveDueTime = async (value: string) => {
    const current = task.due_time ? task.due_time.slice(0, 5) : ''
    if (value === current) return
    await saveField({ due_time: value || null })
  }

  const saveIsPrivate = async (val: boolean) => {
    if (val === task.is_private) return
    await saveField({ is_private: val })
  }

  const saveAssignees = async () => {
    setSaving(true)
    try {
      await setAssignees(task.id, assigneeDraft, user.id, user.role)
      onChanged()
    } finally {
      setSaving(false)
      setEditingAssignees(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(task)
      setConfirmDelete(false)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const handleCommentKey = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      await send()
      await refresh()
      await loadAuxiliary(task.id)
    }
  }

  const sendComment = async () => {
    await send()
    await loadAuxiliary(task.id)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const visibleActivity = activityExpanded ? activity : activity.slice(0, 3)

  const assigneeUsers = (task.assignees || [])
    .map(a => ({ id: a.user_id, username: a.user?.username }))
    .filter(u => !!u.username)

  const body = (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        onKeyDown={handleCommentKey}
        className={`ml-auto relative w-full sm:w-[560px] h-full bg-white dark:bg-gray-800 shadow-xl flex flex-col transform transition-transform duration-200 ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.is_private && <Lock className="w-4 h-4 text-gray-400" />}
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('tasks.detail.header')}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            {editingTitle && canEdit ? (
              <div className="flex gap-2">
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
                    if (e.key === 'Escape') { e.preventDefault(); setTitleDraft(task.title); setEditingTitle(false) }
                  }}
                  autoFocus
                  className="flex-1 px-2 py-1 text-lg font-semibold border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={saveTitle}
                  disabled={saving}
                  className="px-2 text-green-600 hover:text-green-700"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h2
                className={`text-xl font-bold text-gray-900 dark:text-white break-words ${canEdit ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded px-1 -mx-1' : ''}`}
                onClick={() => canEdit && setEditingTitle(true)}
              >
                {task.title}
                {task.status === 'done' && (
                  <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                    {t('tasks.detail.completed_badge')}
                  </span>
                )}
              </h2>
            )}
            {task.creator && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('tasks.detail.assigned_by', { username: task.creator.username })}
                {' · '}
                {formatDate(task.created_at)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={<Activity className="w-4 h-4" />} label={t('tasks.modal.status_label')}>
              <SegmentedControl<TaskStatus>
                size="sm"
                value={task.status}
                onChange={saveStatus}
                options={STATUS_OPTIONS.map(s => ({ value: s, label: t(`tasks.status.${s}`) }))}
              />
            </Field>
            <Field icon={<FolderOpen className="w-4 h-4" />} label={t('tasks.modal.project_label')}>
              <SearchableSelect
                size="sm"
                value={task.project_id}
                options={projectOptions}
                onChange={saveProject}
                placeholder={t('tasks.modal.project_placeholder')}
                searchPlaceholder={t('tasks.modal.project_search_placeholder')}
                disabled={!canEdit}
              />
            </Field>
            <Field icon={<CalendarIcon className="w-4 h-4" />} label={t('tasks.modal.due_date_label')}>
              <input
                type="date"
                value={task.due_date || ''}
                onChange={e => saveDueDate(e.target.value)}
                disabled={!canEdit}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
              />
            </Field>
            <Field icon={<Clock className="w-4 h-4" />} label={t('tasks.modal.due_time_label')}>
              <input
                type="time"
                value={task.due_time ? task.due_time.slice(0, 5) : ''}
                onChange={e => saveDueTime(e.target.value)}
                disabled={!canEdit}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
              />
            </Field>
          </div>

          {task.reminder_offsets.length > 0 && (
            <Field icon={<Bell className="w-4 h-4" />} label={t('tasks.modal.reminders_label')}>
              <div className="flex flex-wrap gap-1.5">
                {task.reminder_offsets.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                  >
                    {m >= 1440 && m % 1440 === 0
                      ? t('tasks.reminders.days_before', { count: m / 1440 })
                      : m >= 60 && m % 60 === 0
                        ? t('tasks.reminders.hours_before', { count: m / 60 })
                        : t('tasks.reminders.minutes_before', { count: m })}
                  </span>
                ))}
              </div>
            </Field>
          )}

          {canEdit && (
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <ToggleSwitch
                checked={task.is_private}
                onChange={saveIsPrivate}
                label={t('tasks.modal.private_label')}
              />
            </div>
          )}

          {!task.is_private && (
            <Field icon={<UserIcon className="w-4 h-4" />} label={t('tasks.detail.assignees')}>
              {editingAssignees && canEdit ? (
                <div className="space-y-2">
                  <ParticipantPicker
                    users={users}
                    selectedIds={assigneeDraft}
                    onChange={setAssigneeDraft}
                    excludeId={user.id}
                    placeholder={t('tasks.modal.assign_placeholder')}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeDraft((task.assignees || []).map(a => a.user_id))
                        setEditingAssignees(false)
                      }}
                      className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={saveAssignees}
                      disabled={saving}
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AvatarStack users={assigneeUsers} max={5} size="sm" />
                  {assigneeUsers.length === 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('tasks.detail.no_assignees')}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingAssignees(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      {t('common.edit')}
                    </button>
                  )}
                </div>
              )}
            </Field>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('tasks.modal.description_label')}
              </div>
              {canEdit && !editingDescription && (
                <button
                  type="button"
                  onClick={() => setEditingDescription(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  {t('common.edit')}
                </button>
              )}
            </div>
            {editingDescription && canEdit ? (
              <div className="space-y-2">
                <SegmentedControl<'edit' | 'preview'>
                  size="sm"
                  value={descPreview}
                  onChange={setDescPreview}
                  options={[
                    { value: 'edit', label: t('tasks.modal.desc_edit'), icon: Edit3 },
                    { value: 'preview', label: t('tasks.modal.desc_preview'), icon: Eye },
                  ]}
                />
                {descPreview === 'edit' ? (
                  <textarea
                    value={descriptionDraft}
                    onChange={e => setDescriptionDraft(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  />
                ) : (
                  <div className="min-h-[120px] px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                    {descriptionDraft.trim() ? (
                      <MarkdownView content={descriptionDraft} />
                    ) : (
                      <div className="text-sm text-gray-400 italic">
                        {t('tasks.modal.description_empty_preview')}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionDraft(task.description || '')
                      setDescFormatDraft(task.description_format)
                      setEditingDescription(false)
                    }}
                    className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={saveDescription}
                    disabled={saving}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            ) : task.description ? (
              task.description_format === 'markdown' ? (
                <MarkdownView content={task.description} />
              ) : (
                <div className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                  {task.description}
                </div>
              )
            ) : (
              <div className="text-sm text-gray-400 italic">
                {t('tasks.detail.no_description')}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              {t('tasks.attachments.label')}
            </div>
            <AttachmentList
              taskId={task.id}
              attachments={attachments}
              userId={user.id}
              userRole={user.role}
              canDelete={a => a.uploaded_by === user.id || task.created_by === user.id}
              onChange={() => loadAuxiliary(task.id)}
              disabled={!canEdit}
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-4 mb-3">
              <button
                type="button"
                onClick={() => setTab('comments')}
                className={`inline-flex items-center gap-1.5 text-sm font-medium pb-1 border-b-2 -mb-px ${tab === 'comments' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400'}`}
              >
                <MessageSquare className="w-4 h-4" />
                {t('tasks.detail.comments', { count: comments.length })}
              </button>
              <button
                type="button"
                onClick={() => setTab('activity')}
                className={`inline-flex items-center gap-1.5 text-sm font-medium pb-1 border-b-2 -mb-px ${tab === 'activity' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400'}`}
              >
                <Activity className="w-4 h-4" />
                {t('tasks.detail.activity')}
              </button>
            </div>

            {tab === 'activity' ? (
              activity.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  {t('tasks.detail.no_activity')}
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleActivity.map(a => (
                    <div
                      key={a.id}
                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <div>
                          <span className="font-medium">{a.username || t('tasks.detail.unknown_user')}</span>
                          {' '}
                          <span className="text-gray-500 dark:text-gray-400">
                            {t(`activity_log.actions.${a.action}`, { defaultValue: a.action })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(a.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {activity.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setActivityExpanded(v => !v)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      {activityExpanded ? (
                        <><ChevronUp className="w-3 h-3" />{t('tasks.detail.show_less')}</>
                      ) : (
                        <><ChevronDown className="w-3 h-3" />{t('tasks.detail.show_all', { count: activity.length })}</>
                      )}
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {commentsLoading ? (
                  <div className="text-center text-sm text-gray-500 py-3">{t('tasks.loading')}</div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-3">
                    {t('tasks.detail.no_comments')}
                  </div>
                ) : (
                  comments.map(c => {
                    const mine = c.user_id === user.id
                    const parts = renderCommentWithMentions(c.comment)
                    return (
                      <div key={c.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {c.user?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className={`flex-1 min-w-0 ${mine ? 'text-right' : ''}`}>
                          <div
                            className={`inline-block max-w-full rounded-lg px-3 py-2 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                          >
                            <div className={`text-xs mb-0.5 ${mine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                              {c.user?.username || '—'} · {formatDate(c.created_at)}
                            </div>
                            <div className="whitespace-pre-wrap break-words text-left">
                              {parts.map((p, i) =>
                                p.type === 'mention' ? (
                                  <span
                                    key={i}
                                    className={`inline-block px-1 rounded ${mine ? 'bg-blue-700 text-white' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'}`}
                                  >
                                    @{p.value}
                                  </span>
                                ) : (
                                  <React.Fragment key={i}>{p.value}</React.Fragment>
                                ),
                              )}
                            </div>
                          </div>
                          {mine && (
                            <button
                              onClick={() => remove(c.id)}
                              className="text-[11px] text-gray-400 hover:text-red-500 inline-flex items-center gap-1 mt-1"
                            >
                              <Trash2 className="w-3 h-3" /> {t('tasks.detail.delete_comment')}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}

                <MentionPicker
                  users={users}
                  value={draft}
                  onChange={setDraft}
                  onSubmit={sendComment}
                  submitting={sending}
                  placeholder={t('tasks.detail.comment_placeholder')}
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          {canDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              {t('tasks.detail.delete_task')}
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {t('common.close')}
          </button>
        </div>
      </aside>
      <ConfirmDialog
        show={confirmDelete}
        title={t('tasks.detail.delete_task_confirm_title')}
        message={t('tasks.detail.delete_task_confirm_message')}
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )

  return createPortal(body, document.body)
}

interface FieldProps {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}

const Field: React.FC<FieldProps> = ({ icon, label, children }) => (
  <div>
    <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
      {icon}
      {label}
    </div>
    {children}
  </div>
)

export default TaskDetail
