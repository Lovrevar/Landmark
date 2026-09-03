import React from 'react'
import { useTranslation } from 'react-i18next'
import { Square, CheckSquare, Paperclip, MessageSquare } from 'lucide-react'
import TaskColorChip from '../../Tasks/components/TaskColorChip'
import { isChecklist, subtaskProgress } from '../../Tasks/subtasks'
import type { TaskOccurrence } from '../utils/expandTasks'

interface Props {
  occurrence: TaskOccurrence
  onClick?: (occurrence: TaskOccurrence) => void
  onToggle?: (occurrence: TaskOccurrence) => void
  compact?: boolean
  showTime?: boolean
  locale?: string
}

const TaskPill: React.FC<Props> = ({
  occurrence,
  onClick,
  onToggle,
  compact = false,
  showTime = false,
  locale = 'en-US',
}) => {
  const { t } = useTranslation()
  const { task, isOverdue, isDone, due_at } = occurrence
  const ToggleIcon = isDone ? CheckSquare : Square
  const attachmentCount = task.attachments?.length ?? 0
  const commentCount = task.comment_count ?? 0
  // Same readout rule as TaskRow: a checklist task's completion belongs to its lines, which
  // are ticked in the detail drawer. Clicking through to the drawer still works.
  const checklist = isChecklist(task)
  const progress = subtaskProgress(task)

  const baseCls = [
    'w-full flex items-center gap-1.5 rounded-sm overflow-hidden',
    'bg-gray-100 dark:bg-gray-700/60 text-gray-800 dark:text-gray-200',
    compact ? 'text-[11px] h-5 px-1' : 'text-xs px-2 py-1',
    isOverdue ? 'border-l-[3px] border-l-red-500' : 'border-l-[3px] border-l-transparent',
    isDone ? 'opacity-60 line-through' : '',
    'hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
  ].filter(Boolean).join(' ')

  return (
    <div className={baseCls} title={task.title}>
      <button
        type="button"
        disabled={checklist}
        onClick={e => { e.stopPropagation(); onToggle?.(occurrence) }}
        title={
          checklist
            ? t('tasks.subtasks.governed_tooltip', { done: progress.done, total: progress.total })
            : undefined
        }
        className="flex-shrink-0 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:hover:text-gray-500"
      >
        <ToggleIcon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </button>
      {/* Dot only — a pill this narrow has no room for the label, and the red left border
          still belongs to the deadline. */}
      <TaskColorChip color={task.color} dotOnly />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClick?.(occurrence) }}
        className="flex-1 min-w-0 text-left truncate hover:underline"
      >
        {showTime && task.due_time && (
          <span className="opacity-70 mr-1">
            {due_at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {task.title}
      </button>
      {(attachmentCount > 0 || commentCount > 0) && !compact && (
        <span className="flex items-center gap-1 flex-shrink-0 opacity-70">
          {attachmentCount > 0 && <Paperclip className="w-3 h-3" />}
          {commentCount > 0 && <MessageSquare className="w-3 h-3" />}
        </span>
      )}
    </div>
  )
}

export default TaskPill
