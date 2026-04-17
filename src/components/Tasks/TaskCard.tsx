import React from 'react'
import { Clock, Lock, Trash2, Check } from 'lucide-react'
import type { Task, TaskPriority } from '../../types/tasks'

interface Props {
  task: Task
  currentUserId: string
  onToggleStatus: (task: Task) => void
  onDelete: (task: Task) => void
  onClick: (task: Task) => void
}

const priorityBorder: Record<TaskPriority, string> = {
  low: 'border-l-gray-400',
  normal: 'border-l-blue-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
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

const TaskCard: React.FC<Props> = ({ task, currentUserId, onToggleStatus, onDelete, onClick }) => {
  const done = task.status === 'done'
  const canDelete = task.created_by === currentUserId

  return (
    <div
      onClick={() => onClick(task)}
      className={`bg-white dark:bg-gray-800 rounded-lg border-l-4 ${priorityBorder[task.priority]} border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer flex gap-3`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStatus(task) }}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${done ? 'bg-green-500 border-green-500' : 'border-gray-400 hover:border-blue-500'}`}
        title={done ? 'Oznaci kao nedovrseno' : 'Oznaci kao zavrseno'}
      >
        {done && <Check className="w-4 h-4 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-sm font-semibold ${done ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {task.title}
            {task.is_private && <Lock className="w-3 h-3 inline-block ml-1 text-gray-400" />}
          </h3>
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task) }}
              className="text-gray-400 hover:text-red-500"
              title="Obrisi"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
          {task.due_date && (
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              {task.due_date}{task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
            </span>
          )}
          <span className="text-gray-500 dark:text-gray-400">{priorityLabel[task.priority]}</span>
          <span className="text-gray-500 dark:text-gray-400">{statusLabel[task.status]}</span>
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignees.slice(0, 3).map(a => (
                <span key={a.id} className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] flex items-center justify-center border border-white dark:border-gray-800 font-semibold">
                  {a.user?.username.charAt(0).toUpperCase() || '?'}
                </span>
              ))}
              {task.assignees.length > 3 && (
                <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] flex items-center justify-center border border-white dark:border-gray-800">+{task.assignees.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskCard
