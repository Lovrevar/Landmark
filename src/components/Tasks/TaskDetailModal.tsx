import React, { useCallback, useEffect, useState } from 'react'
import { MessageSquare, Send, Trash2, Lock, Clock, User as UserIcon } from 'lucide-react'
import Modal from '../ui/Modal'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchTaskComments,
  createTaskComment,
  deleteTaskComment,
} from './services/tasksService'
import type { Task, TaskComment, TaskPriority } from '../../types/tasks'

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

const priorityLabel: Record<TaskPriority, string> = {
  low: 'Niski',
  normal: 'Normalni',
  high: 'Visoki',
  urgent: 'Hitno',
}

const statusLabel: Record<Task['status'], string> = {
  todo: 'Za obaviti',
  in_progress: 'U tijeku',
  done: 'Zavrseno',
  cancelled: 'Otkazano',
}

const TaskDetailModal: React.FC<Props> = ({ task, onClose }) => {
  const { user } = useAuth()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!task) return
    setLoading(true)
    try {
      const data = await fetchTaskComments(task.id)
      setComments(data)
    } finally {
      setLoading(false)
    }
  }, [task])

  useEffect(() => {
    if (task) {
      setDraft('')
      load()
    }
  }, [task, load])

  if (!task) return null

  const handleSend = async () => {
    if (!user || !draft.trim() || sending) return
    setSending(true)
    try {
      await createTaskComment(task.id, user.id, draft)
      setDraft('')
      await load()
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Obrisati komentar?')) return
    await deleteTaskComment(id)
    load()
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Modal show={!!task} onClose={onClose} size="lg">
      <Modal.Header
        title={task.title}
        subtitle={task.creator ? `Zadao: ${task.creator.username}` : undefined}
        onClose={onClose}
      />
      <Modal.Body>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${priorityStyles[task.priority]}`}>
              {priorityLabel[task.priority]}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              {statusLabel[task.status]}
            </span>
            {task.is_private && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Privatno
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
                Izvrsitelji
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
              Komentari ({comments.length})
            </h4>

            {loading ? (
              <div className="text-center text-sm text-gray-500 py-4">Ucitavanje...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
                Jos nema komentara. Budi prvi!
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
                            {new Date(c.created_at).toLocaleString('hr-HR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-left">{c.comment}</div>
                        </div>
                        {mine && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="text-[11px] text-gray-400 hover:text-red-500 inline-flex items-center gap-1 mt-1"
                          >
                            <Trash2 className="w-3 h-3" /> Obrisi
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
                placeholder="Napisi komentar... (Ctrl+Enter za slanje)"
                className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Posalji
              </button>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          Zatvori
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default TaskDetailModal
