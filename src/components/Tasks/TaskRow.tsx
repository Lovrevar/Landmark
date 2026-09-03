import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, MessageSquare, Trash2, Lock, Square, CheckSquare } from 'lucide-react'
import AvatarStack from '../ui/AvatarStack'
import TaskColorChip from './components/TaskColorChip'
import { relativeLabel } from '../Calendar/utils/relativeLabel'
import { isChecklist, subtaskProgress } from './subtasks'
import type { Task } from '../../types/tasks'

interface Props {
  task: Task
  currentUserId: string
  canEdit: boolean
  onToggleDone: (task: Task) => void
  onDelete: (task: Task) => void
  onClick: (task: Task) => void
}

function dueDateAsDate(task: Task): Date | null {
  if (!task.deadline) return null
  const time = task.due_time ? task.due_time.slice(0, 5) : '23:59'
  return new Date(`${task.deadline}T${time}`)
}

const TaskRow: React.FC<Props> = ({
  task,
  currentUserId,
  canEdit,
  onToggleDone,
  onDelete,
  onClick,
}) => {
  const { t } = useTranslation()
  const done = task.completed
  const canDelete = canEdit && task.created_by === currentUserId
  // A checklist task's completion is written by a database trigger when its last line is
  // ticked, so this checkbox is a readout. Leaving it live would let a click here stick and
  // then be silently reverted by the next tick in the drawer. The count goes in the tooltip
  // so a disabled checkbox is not unexplained.
  const checklist = isChecklist(task)
  const progress = subtaskProgress(task)

  const due = useMemo(() => dueDateAsDate(task), [task])
  const now = useMemo(() => new Date(), [])
  const overdue = !!due && !done && due.getTime() < now.getTime()

  const relative = due ? relativeLabel(due, now, t) : null

  const assigneeUsers = useMemo(
    () =>
      (task.assignees || [])
        .map(a => ({ id: a.assignee_id, username: a.user?.username }))
        .filter(u => !!u.username),
    [task.assignees],
  )

  const hasUnread = !!(task.assignees || []).find(
    a => a.assignee_id === currentUserId && a.acknowledged_at == null,
  )
  const attachmentCount = task.attachments?.length || 0
  const commentCount = task.comment_count || 0

  const CheckIcon = done ? CheckSquare : Square

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
      className={`group relative flex items-center gap-3 pl-4 pr-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow cursor-pointer ${overdue ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <button
        type="button"
        disabled={!canEdit || checklist}
        onClick={e => {
          e.stopPropagation()
          onToggleDone(task)
        }}
        className={`flex-shrink-0 p-2 -m-2 transition-colors ${
          done
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'
        } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-gray-400`}
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
        <CheckIcon className="w-6 h-6" />
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
            className={`truncate text-base font-medium ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}
          >
            {task.title}
          </span>
          {task.is_private && (
            <Lock className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          {/* The colour label sits beside the deadline but never replaces it: the red left
              border above is the "is this late" signal and stays deadline-driven. */}
          <TaskColorChip color={task.color} />
          {relative && (
            // No "Overdue," prefix: relativeLabel already words a past deadline as
            // "3 d ago", and the red says the rest.
            <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
              {relative}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="w-4 h-4" />
              {attachmentCount}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {commentCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <AvatarStack users={assigneeUsers} max={3} size="sm" />
        {canDelete && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onDelete(task)
            }}
            className="p-2 -m-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            title={t('tasks.row.delete')}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default TaskRow
