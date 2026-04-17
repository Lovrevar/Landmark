import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Send, Trash2, Lock, Clock, User as UserIcon } from 'lucide-react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { useTaskComments } from './hooks/useTaskComments'
import type { Task, TaskPriority } from '../../types/tasks'

interface Props {
  task: Task | null
  onClose: () => void
}

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
}

const TaskDetailModal: React.FC<Props> = ({ task, onClose }) => {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const dateLocale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  const { comments, loading, draft, setDraft, sending, send, remove } = useTaskComments(task?.id ?? null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!task) return null

  const confirmDeleteComment = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await remove(pendingDeleteId)
      setPendingDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <Modal show={!!task} onClose={onClose} size="lg">
        <Modal.Header
          title={task.title}
          subtitle={task.creator ? t('tasks.detail.assigned_by', { username: task.creator.username }) : undefined}
          onClose={onClose}
        />
        <Modal.Body>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${priorityStyles[task.priority]}`}>
                {t(`tasks.priority.${task.priority}`)}
              </span>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {t(`tasks.status.${task.status}`)}
              </span>
              {task.is_private && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> {t('tasks.detail.private_badge')}
                </span>
              )}
              {task.due_date && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {task.due_date}{task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
                </span>
              )}
            </div>

            {task.description && (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                {task.description}
              </div>
            )}

            {task.assignees && task.assignees.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {t('tasks.detail.assignees')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.map(a => (
                    <span key={a.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                      <UserIcon className="w-3 h-3" />
                      {a.user?.username || '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4" />
                {t('tasks.detail.comments', { count: comments.length })}
              </h4>

              {loading ? (
                <div className="text-center text-sm text-gray-500 py-4">{t('tasks.loading')}</div>
              ) : comments.length === 0 ? (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
                  {t('tasks.detail.no_comments')}
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {comments.map(c => {
                    const mine = c.user_id === user?.id
                    return (
                      <div key={c.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {c.user?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className={`flex-1 min-w-0 ${mine ? 'text-right' : ''}`}>
                          <div className={`inline-block max-w-full rounded-lg px-3 py-2 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                            <div className={`text-xs mb-0.5 ${mine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                              {c.user?.username || '—'}
                              {' - '}
                              {new Date(c.created_at).toLocaleString(dateLocale, {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                            <div className="whitespace-pre-wrap break-words text-left">{c.comment}</div>
                          </div>
                          {mine && (
                            <button
                              onClick={() => setPendingDeleteId(c.id)}
                              className="text-[11px] text-gray-400 hover:text-red-500 inline-flex items-center gap-1 mt-1"
                            >
                              <Trash2 className="w-3 h-3" /> {t('tasks.detail.delete_comment')}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-4 flex gap-2 items-end">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKey}
                  rows={2}
                  placeholder={t('tasks.detail.comment_placeholder')}
                  className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {t('tasks.detail.send_comment')}
                </button>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            {t('common.close')}
          </button>
        </Modal.Footer>
      </Modal>
      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('tasks.detail.delete_comment_confirm_title')}
        message={t('tasks.detail.delete_comment_confirm_message')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteComment}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  )
}

export default TaskDetailModal
