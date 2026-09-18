import React from 'react'
import { useTranslation } from 'react-i18next'
import { Square, CheckSquare, Paperclip, MessageSquare, AlertTriangle } from 'lucide-react'
import TaskColorChip from '../../Tasks/components/TaskColorChip'
import { COLOR_STYLES, isTaskColor } from '../../Tasks/taskColor'
import { completionToggle } from '../../Tasks/permissions'
import type { TaskOccurrence } from '../utils/expandTasks'

interface Props {
  occurrence: TaskOccurrence
  /** The signed-in user's auth id; decides whether the checkbox is live. */
  currentUserId: string | null | undefined
  onClick?: (occurrence: TaskOccurrence) => void
  /** Without it the checkbox renders disabled — a pill with nowhere to send the toggle. */
  onToggle?: (occurrence: TaskOccurrence) => void
  compact?: boolean
  showTime?: boolean
  locale?: string
}

const TaskPill: React.FC<Props> = ({
  occurrence,
  currentUserId,
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
  // Same rules as TaskRow: a checklist task's completion belongs to its lines, which are ticked
  // in the detail drawer, and someone who can't edit the task gets a read-only box. Clicking
  // through to the drawer still works either way.
  const toggle = completionToggle(task, currentUserId, t)
  const overdueLabel = t('calendar.task_pill.overdue')

  // The task's colour label tints the pill, as it tints the card in the task list (TaskRow). No
  // colour keeps the old neutral grey rather than TaskRow's white, which would vanish on the grid.
  // Hover darkens whatever the tint is instead of swapping it for grey.
  const color = isTaskColor(task.color) ? task.color : null
  const surface = color
    ? COLOR_STYLES[color].card
    : 'bg-gray-100 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600'

  const baseCls = [
    'w-full flex items-center gap-1.5 rounded-sm overflow-hidden border',
    surface,
    'text-gray-800 dark:text-gray-200',
    compact ? 'text-[11px] h-5 px-1' : 'text-xs px-2 py-1',
    isDone ? 'opacity-60 line-through' : '',
    'hover:brightness-95 dark:hover:brightness-125 transition',
  ].filter(Boolean).join(' ')

  return (
    <div className={baseCls} title={task.title}>
      <button
        type="button"
        disabled={toggle.disabled || !onToggle}
        onClick={e => { e.stopPropagation(); onToggle?.(occurrence) }}
        title={toggle.title}
        aria-label={toggle.title}
        className="flex-shrink-0 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:hover:text-gray-500"
      >
        <ToggleIcon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </button>
      {/* The dot repeats the tint's colour where there is room for it, and says its name on
          hover. In the compact month pill the tint carries the colour alone, as in TaskRow the
          name survives only for screen readers. */}
      {!compact && <TaskColorChip color={task.color} dotOnly />}
      {compact && color && <span className="sr-only">{t(`tasks.colors.${color}`)}</span>}
      {/* Lateness is an icon, not a red left border: on the calendar the left border is the event
          type's, and red there means a deadline event. (The task list, with no events to
          compete, keeps its red stripe.) */}
      {isOverdue && (
        <span role="img" title={overdueLabel} aria-label={overdueLabel} className="flex-shrink-0 inline-flex">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        </span>
      )}
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
