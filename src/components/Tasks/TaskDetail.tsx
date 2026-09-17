import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  X,
  Trash2,
  Edit2,
  Check,
  MessageSquare,
  Lock,
  FolderOpen,
  Calendar as CalendarIcon,
  User as UserIcon,
  Square,
  CheckSquare,
  Plus,
  Search,
  Tag,
} from 'lucide-react'
import ConfirmDialog from '../ui/ConfirmDialog'
import ErrorState from '../ui/ErrorState'
import SearchableSelect from '../ui/SearchableSelect'
import ToggleSwitch from '../ui/ToggleSwitch'
import MarkdownView from '../ui/MarkdownView'
import AttachmentList from './components/AttachmentList'
import SubtaskList from './components/SubtaskList'
import MentionPicker from './components/MentionPicker'
import TaskColorChip from './components/TaskColorChip'
import TaskColorPicker from './components/TaskColorPicker'
import { renderCommentWithMentions } from './components/mentions'
import { useTaskComments } from './hooks/useTaskComments'
import {
  fetchProjectOptions,
  fetchTaskUsers,
  listTaskAttachments,
  setAssignees,
  updateTask,
  type ProjectOption,
} from './services/tasksService'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { isChecklist, subtaskProgress } from './subtasks'
import { canEditTask } from './permissions'
import type {
  Task,
  TaskAttachment,
  TaskUser,
  UpdateTaskInput,
} from '../../types/tasks'
import type { TaskColor } from './taskColor'

interface Props {
  task: Task | null
  onClose: () => void
  onDelete: (task: Task) => void
  onChanged: () => void
}

const TaskDetail: React.FC<Props> = ({ task, onClose, onDelete, onChanged }) => {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const { user } = useAuth()
  const toast = useToast()
  const [mounted, setMounted] = useState(false)

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [addingAssignee, setAddingAssignee] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState('')
  const [saving, setSaving] = useState(false)
  // The date input edits a draft; it is written on blur or Enter, never per keystroke.
  // A native date input reports a complete value on every key, so typing a year used to
  // save 0002, 0020 and 0202 on the way to 2026.
  const [deadlineDraft, setDeadlineDraft] = useState('')
  // The value last sent to the server, until `task.deadline` catches up. Enter followed by
  // blur (or blur followed by Escape) would otherwise write the same date twice.
  const savingDeadlineRef = useRef<string | null>(null)

  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingCommentDelete, setPendingCommentDelete] = useState<string | null>(null)
  const [deletingComment, setDeletingComment] = useState(false)

  const {
    comments,
    loading: commentsLoading,
    error: commentsError,
    draft,
    setDraft,
    sending,
    send,
    remove,
    refresh: refreshComments,
  } = useTaskComments(task?.id ?? null)

  const taskIdRef = useRef(task?.id)

  const loadAttachments = useCallback(async (taskId: string) => {
    const atts = await listTaskAttachments(taskId).catch(() => [])
    setAttachments(atts)
  }, [])

  useEffect(() => {
    setMounted(!!task)
    if (task) {
      taskIdRef.current = task.id
      setTitleDraft(task.title)
      setDescriptionDraft(task.description || '')
      setEditingTitle(false)
      setEditingDescription(false)
      setAddingAssignee(false)
      setAssigneeQuery('')
      setPendingCommentDelete(null)
      loadAttachments(task.id)
      fetchProjectOptions().then(setProjects).catch(() => setProjects([]))
      fetchTaskUsers().then(setUsers).catch(() => setUsers([]))
    }
  }, [task, loadAttachments])

  // Seeded apart from the drafts above: `task` is a new object on every refetch, and the
  // task list refetches on anyone's edit. Keying on the stored value means a half-typed date
  // survives an unrelated refresh but still follows a real change to the deadline.
  const taskId = task?.id
  const taskDeadline = task?.deadline
  useEffect(() => {
    setDeadlineDraft(taskDeadline || '')
    savingDeadlineRef.current = null
  }, [taskId, taskDeadline])

  const drawerRef = useRef<HTMLElement>(null)
  // Set on every render below the early return, where the flush has what it needs.
  const requestCloseRef = useRef(onClose)
  useEscapeKey(!!task, () => requestCloseRef.current())
  useFocusTrap(drawerRef, !!task)

  const projectOptions = useMemo(
    () => projects.map(p => ({ value: p.id, label: p.name })),
    [projects],
  )

  if (!task || !user) return null

  const canEdit = canEditTask(task, user.auth_user_id)
  const canDelete = task.created_by === user.auth_user_id
  const done = task.completed
  // On a checklist task the trigger owns `completed`; the checkbox below becomes a readout.
  const checklist = isChecklist(task)
  const progress = subtaskProgress(task)

  /** Writes one patch. Returns false (after telling the user) when the write failed. */
  const saveField = async (patch: UpdateTaskInput): Promise<boolean> => {
    setSaving(true)
    try {
      await updateTask(task.id, patch, user, task.title)
      onChanged()
      return true
    } catch (e) {
      console.error('Failed to update task', e)
      toast.error(t('tasks.detail.save_failed'))
      return false
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
    // A failed save leaves the editor open, so the typed title is not lost.
    if (await saveField({ title: titleDraft.trim() })) setEditingTitle(false)
  }

  const saveDescription = async () => {
    if (descriptionDraft === task.description) {
      setEditingDescription(false)
      return
    }
    const saved = await saveField({
      description: descriptionDraft,
      description_format: 'plain',
    })
    if (saved) setEditingDescription(false)
  }

  const toggleDone = async () => {
    await saveField({ completed: !done })
  }

  const saveProject = async (pid: string | null) => {
    if (pid === task.project_id) return
    await saveField({ project_id: pid })
  }

  // An empty value clears the deadline.
  const saveDueDate = async (value: string) => {
    if (value === (task.deadline || '') || value === savingDeadlineRef.current) return
    savingDeadlineRef.current = value
    const saved = await saveField({ deadline: value || null, due_time: null })
    if (!saved) {
      savingDeadlineRef.current = null
      setDeadlineDraft(task.deadline || '')
    }
  }

  // Escape unmounts the drawer without blurring the date input, so a changed draft is
  // flushed here first. The X, the backdrop and Close go through the same path; for those
  // the blur has usually saved already and the ref guard turns this into a no-op.
  const requestClose = () => {
    if (canEdit && deadlineDraft !== (task.deadline || '')) void saveDueDate(deadlineDraft)
    onClose()
  }
  requestCloseRef.current = requestClose

  const saveColor = async (color: TaskColor | null) => {
    if (color === task.color) return
    await saveField({ color })
  }

  const saveIsPrivate = async (val: boolean) => {
    if (val === task.is_private) return
    await saveField({ is_private: val })
  }

  // RLS: only the task creator may insert/delete task_assignees rows
  const canManageAssignees = task.created_by === user.auth_user_id
  const currentAssigneeIds = (task.assignees || []).map(a => a.assignee_id)

  const changeAssignees = async (ids: string[]) => {
    setSaving(true)
    try {
      await setAssignees(task.id, ids, user)
      onChanged()
    } catch (e) {
      console.error('Failed to update task assignees', e)
      toast.error(t('tasks.detail.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const addAssignee = async (id: string) => {
    setAddingAssignee(false)
    setAssigneeQuery('')
    await changeAssignees([...currentAssigneeIds, id])
  }

  const removeAssignee = async (id: string) => {
    await changeAssignees(currentAssigneeIds.filter(x => x !== id))
  }

  const assigneeCandidates = users.filter(
    u =>
      u.id !== user.auth_user_id &&
      !currentAssigneeIds.includes(u.id) &&
      (!assigneeQuery.trim() ||
        u.username.toLowerCase().includes(assigneeQuery.trim().toLowerCase())),
  ).slice(0, 50)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(task)
      setConfirmDelete(false)
      onClose()
    } catch (e) {
      // The drawer and its confirm dialog both stay open: the task is still there.
      console.error('Failed to delete task', e)
      toast.error(t('tasks.row.delete_failed'))
    } finally {
      setDeleting(false)
    }
  }

  /** The composer keeps the draft when the insert fails, so nothing typed is lost. */
  const handleSendComment = async () => {
    const sent = await send()
    if (!sent) toast.error(t('tasks.detail.comment_failed'))
  }

  const confirmCommentDelete = async () => {
    const commentId = pendingCommentDelete
    if (!commentId) return
    setDeletingComment(true)
    const removed = await remove(commentId)
    setDeletingComment(false)
    setPendingCommentDelete(null)
    if (!removed) toast.error(t('tasks.detail.delete_comment_failed'))
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const assigneeUsers = (task.assignees || [])
    .map(a => ({ id: a.assignee_id, username: a.user?.username }))
    .filter(u => !!u.username)

  const DoneIcon = done ? CheckSquare : Square

  const body = (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={requestClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        tabIndex={-1}
        className={`ml-auto relative w-full md:w-[560px] h-full bg-white dark:bg-gray-800 shadow-xl flex flex-col transform transition-transform duration-200 outline-none ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="safe-top px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.is_private && <Lock className="w-4 h-4 text-gray-400" />}
            <span className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('tasks.detail.header')}
            </span>
          </div>
          <button
            onClick={requestClose}
            className="p-2 -m-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('common.close')}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              disabled={!canEdit || saving || checklist}
              onClick={toggleDone}
              className={`flex-shrink-0 mt-1 transition-colors ${
                done
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'
              } disabled:cursor-not-allowed disabled:opacity-50`}
              title={
                checklist
                  ? t('tasks.subtasks.governed_tooltip', {
                      done: progress.done,
                      total: progress.total,
                    })
                  : !canEdit
                    ? t('tasks.row.read_only')
                    : done
                      ? t('tasks.row.mark_open')
                      : t('tasks.row.mark_done')
              }
            >
              <DoneIcon className="w-7 h-7" />
            </button>
            <div className="flex-1 min-w-0">
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
                  className={`text-2xl font-bold break-words ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'} ${canEdit ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded px-1 -mx-1' : ''}`}
                  onClick={() => canEdit && setEditingTitle(true)}
                >
                  {task.title}
                </h2>
              )}
              {task.creator && (
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('tasks.detail.assigned_by', { username: task.creator.username })}
                  {' · '}
                  {formatDate(task.created_at)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={<FolderOpen className="w-4 h-4" />} label={t('tasks.modal.project_label')}>
              <SearchableSelect
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
                value={deadlineDraft}
                onChange={e => setDeadlineDraft(e.target.value)}
                onBlur={e => saveDueDate(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveDueDate(e.currentTarget.value) }
                }}
                disabled={!canEdit}
                className="w-full px-2 py-1.5 text-base border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
              />
            </Field>
          </div>

          {(canEdit || task.color) && (
            <Field icon={<Tag className="w-4 h-4" />} label={t('tasks.modal.color_label')}>
              {canEdit ? (
                <div className="pt-1">
                  <TaskColorPicker value={task.color} onChange={saveColor} disabled={saving} />
                </div>
              ) : (
                <TaskColorChip color={task.color} />
              )}
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
              <div className="flex flex-wrap items-start gap-x-6 gap-y-4 pt-2">
                {assigneeUsers.map(u => (
                  <div key={u.id} className="flex flex-col items-center gap-1.5 w-20">
                    <div className="relative">
                      <div
                        className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 flex items-center justify-center text-xl font-semibold"
                        title={u.username}
                      >
                        {u.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      {canManageAssignees && (
                        <button
                          type="button"
                          onClick={() => removeAssignee(u.id)}
                          disabled={saving}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-500 hover:bg-red-600 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-gray-800 disabled:opacity-50"
                          title={t('common.remove')}
                          aria-label={t('common.remove')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300 truncate w-full text-center">
                      {u.username}
                    </span>
                  </div>
                ))}

                {canManageAssignees && (
                  <div className="flex flex-col items-center gap-1.5 w-20">
                    <button
                      type="button"
                      onClick={() => setAddingAssignee(v => !v)}
                      disabled={saving}
                      className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center disabled:opacity-50"
                      title={t('tasks.detail.add_assignee')}
                    >
                      <Plus className="w-7 h-7" />
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {t('tasks.detail.add_assignee')}
                    </span>
                  </div>
                )}

                {assigneeUsers.length === 0 && !canManageAssignees && (
                  <span className="text-base text-gray-500 dark:text-gray-400">
                    {t('tasks.detail.no_assignees')}
                  </span>
                )}
              </div>

              {addingAssignee && canManageAssignees && (
                <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      value={assigneeQuery}
                      onChange={e => setAssigneeQuery(e.target.value)}
                      placeholder={t('tasks.modal.assign_placeholder')}
                      autoFocus
                      className="flex-1 bg-transparent text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {assigneeCandidates.length === 0 ? (
                      <div className="px-3 py-2 text-base text-gray-500 dark:text-gray-400">
                        {t('calendar.modal.participant_no_results')}
                      </div>
                    ) : (
                      assigneeCandidates.map(u => (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => addAssignee(u.id)}
                          className="w-full px-3 py-2.5 text-left text-base flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <span className="text-gray-900 dark:text-gray-100">{u.username}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{u.role}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Field>
          )}

          {/* Sits above the description rather than replacing it: unlike the mobile app's
              card, Cognilion's description carries description_format, markdown rendering
              and real prose that is not a list. */}
          {(canEdit || checklist) && (
            <SubtaskList
              taskId={task.id}
              subtasks={task.subtasks || []}
              actor={user}
              canEdit={canEdit}
              onChange={onChanged}
            />
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
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  {t('common.edit')}
                </button>
              )}
            </div>
            {editingDescription && canEdit ? (
              <div className="space-y-2">
                <textarea
                  value={descriptionDraft}
                  onChange={e => setDescriptionDraft(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionDraft(task.description || '')
                      setEditingDescription(false)
                    }}
                    className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={saveDescription}
                    disabled={saving}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            ) : task.description ? (
              task.description_format === 'markdown' ? (
                <MarkdownView content={task.description} />
              ) : (
                <div className="text-base whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                  {task.description}
                </div>
              )
            ) : (
              <div className="text-base text-gray-400 italic">
                {t('tasks.detail.no_description')}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              {t('tasks.attachments.label')}
            </div>
            <AttachmentList
              taskId={task.id}
              attachments={attachments}
              actor={user}
              canDelete={a =>
                canEdit &&
                (a.uploaded_by === user.auth_user_id || task.created_by === user.auth_user_id)
              }
              onChange={() => loadAttachments(task.id)}
              disabled={!canEdit}
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="inline-flex items-center gap-1.5 text-base font-medium text-gray-700 dark:text-gray-200 mb-3">
              <MessageSquare className="w-4 h-4" />
              {t('tasks.detail.comments', { count: comments.length })}
            </div>

            <div className="space-y-3">
              {commentsLoading ? (
                <div className="text-center text-sm text-gray-500 py-3">{t('tasks.loading')}</div>
              ) : commentsError && comments.length === 0 ? (
                <ErrorState compact onRetry={() => { void refreshComments() }} />
              ) : comments.length === 0 ? (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-3">
                  {t('tasks.detail.no_comments')}
                </div>
              ) : (
                comments.map(c => {
                  const mine = c.user_id === user.auth_user_id
                  const parts = renderCommentWithMentions(c.comment)
                  return (
                    <div key={c.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {c.user?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className={`flex-1 min-w-0 ${mine ? 'text-right' : ''}`}>
                        <div
                          className={`inline-block max-w-full rounded-lg px-3 py-2 text-base ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        >
                          <div className={`text-sm mb-0.5 ${mine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
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
                            type="button"
                            onClick={() => setPendingCommentDelete(c.id)}
                            className="text-sm text-gray-400 hover:text-red-500 inline-flex items-center gap-1 mt-1"
                          >
                            <Trash2 className="w-3 h-3" /> {t('tasks.detail.delete_comment')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}

              {canEdit && (
                <MentionPicker
                  users={users}
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => { void handleSendComment() }}
                  submitting={sending}
                  placeholder={t('tasks.detail.comment_placeholder')}
                />
              )}
            </div>
          </div>
        </div>

        <div className="safe-bottom px-4 sm:px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          {canDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 text-base text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              {t('tasks.detail.delete_task')}
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={requestClose}
            className="px-4 py-2 text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {t('common.close')}
          </button>
        </div>
      </aside>
      <ConfirmDialog
        show={!!pendingCommentDelete}
        title={t('tasks.detail.delete_comment_confirm_title')}
        message={t('tasks.detail.delete_comment_confirm_message')}
        variant="danger"
        confirmLabel={t('tasks.detail.delete_comment')}
        loading={deletingComment}
        onConfirm={confirmCommentDelete}
        onCancel={() => setPendingCommentDelete(null)}
      />
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
    <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
      {icon}
      {label}
    </div>
    {children}
  </div>
)

export default TaskDetail
