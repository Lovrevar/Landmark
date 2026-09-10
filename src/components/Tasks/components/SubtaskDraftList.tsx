import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, ChevronUp, ChevronDown, Plus, Check, GripVertical } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (titles: string[]) => void
  disabled?: boolean
}

/**
 * The checklist editor on the create modal.
 *
 * Deliberately not SubtaskList: that one writes to task_subtasks on every keystroke and needs
 * a task id, which does not exist until the task is saved. This holds nothing but strings and
 * hands them to createTask, which writes the rows once the task has an id.
 *
 * Two things it does not have, both following from the same rule — a task cannot be born with
 * items already crossed off, which is why `completed` is withheld from every creation path:
 *   - no checkboxes. There is nothing to tick before the work exists.
 *   - no confirm on remove. An unsaved draft line is not worth a dialog.
 */
const SubtaskDraftList: React.FC<Props> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const add = () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    onChange([...value, title])
  }

  const commitRename = (index: number) => {
    const title = editDraft.trim()
    setEditingIndex(null)
    if (!title) return
    onChange(value.map((v, i) => (i === index ? title : v)))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('tasks.subtasks.label')}
        </label>
        {value.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {t('tasks.subtasks.progress', { done: 0, total: value.length })}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {value.map((title, index) => (
          <div key={index} className="group flex items-start gap-2">
            <GripVertical className="w-4 h-4 mt-1 flex-shrink-0 text-gray-300 dark:text-gray-600" />

            {editingIndex === index ? (
              <div className="flex-1 flex gap-2">
                <input
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={() => commitRename(index)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(index) }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingIndex(null) }
                  }}
                  autoFocus
                  className="flex-1 px-2 py-1 text-base border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => commitRename(index)}
                  className="px-1 text-green-600 hover:text-green-700"
                  title={t('common.save')}
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <span
                onClick={() => {
                  if (disabled) return
                  setEditingIndex(index)
                  setEditDraft(title)
                }}
                className={`flex-1 min-w-0 text-base whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200 ${
                  disabled ? '' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded px-1 -mx-1'
                }`}
              >
                {title}
              </span>
            )}

            {editingIndex !== index && (
              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={disabled || index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                  title={t('tasks.subtasks.move_up')}
                  aria-label={t('tasks.subtasks.move_up')}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={disabled || index === value.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                  title={t('tasks.subtasks.move_down')}
                  aria-label={t('tasks.subtasks.move_down')}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                  title={t('tasks.subtasks.remove')}
                  aria-label={t('tasks.subtasks.remove')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <Plus className="w-5 h-5 flex-shrink-0 text-gray-400" />
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); add() }
            }}
            onBlur={add}
            disabled={disabled}
            placeholder={t('tasks.subtasks.add_placeholder')}
            className="flex-1 px-2 py-1 text-base bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      {value.length > 0 && (
        <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          {t('tasks.subtasks.governs_task')}
        </div>
      )}
    </div>
  )
}

export default SubtaskDraftList
