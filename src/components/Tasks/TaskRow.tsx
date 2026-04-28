import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, MessageSquare, Trash2, Lock, FolderOpen } from 'lucide-react'
import AvatarStack from '../ui/AvatarStack'
import { relativeLabel } from '../Calendar/utils/relativeLabel'
import type { Task, TaskStatus } from '../../types/tasks'

interface Props {
  task: Task
  currentUserId: string
  projectName?: string | null
  onCycleStatus: (task: Task) => void
  onDelete: (task: Task) => void
  onClick: (task: Task) => void
}

const statusTone: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200',
  in_progress: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  done: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
}

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

function dueDateAsDate(task: Task): Date | null {
  if (!task.due_date) return null
  const time = task.due_time ? task.due_time.slice(0, 5) : '23:59'
  return new Date(`${task.due_date}T${time}`)
}

const TaskRow: React.FC<Props> = ({
  task,
  currentUserId,
  projectName,
  onCycleStatus,
  onDelete,
  onClick,
}) => {
  const { t } = useTranslation()
  const done = task.status === 'done'
  const canDelete = task.created_by === currentUserId

  const due = useMemo(() => dueDateAsDate(task), [task])
  const now = useMemo(() => new Date(), [])
  const overdue = !!due && !done && due.getTime() < now.getTime()

  const relative = due ? relativeLabel(due, now, t) : null

  const assigneeUsers = useMemo(
    () =>
      (task.assignees || [])
        .map(a => ({ id: a.user_id, username: a.user?.username }))
        .filter(u => !!u.username),
    [task.assignees],
  )

  const hasUnread = !!(task.assignees || []).find(
    a => a.user_id === currentUserId && a.acknowledged_at == null,
  )
  const attachmentCount = task.attachments?.length || 0
  const commentCount = task.comment_count || 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(task)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(task)
        }
      }}
      className={`group relative flex items-center gap-3 pl-3 pr-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow cursor-pointer ${overdue ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onCycleStatus({ ...task, status: STATUS_CYCLE[task.status] })
        }}
        className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${statusTone[task.status]}`}
        title={t('tasks.row.cycle_status_hint')}
      >
        {t(`tasks.status.${task.status}`)}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 min-w-0">
          {hasUnread && (
            <span
              className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"
              title={t('tasks.row.unread')}
            />
          )}
          <span
            className={`truncate text-sm font-medium ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}
          >
            {task.title}
          </span>
          {task.is_private && (
            <Lock className="w-3 h-3 text-gray-400" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {projectName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <FolderOpen className="w-3 h-3" />
              {projectName}
            </span>
          )}
          {relative && (
            <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
              {overdue ? t('tasks.row.overdue_prefix') + ' ' : ''}
              {relative}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="w-3 h-3" />
              {attachmentCount}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {commentCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <AvatarStack users={assigneeUsers} max={3} size="xs" />
        {canDelete && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onDelete(task)
            }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            title={t('tasks.row.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default TaskRow
