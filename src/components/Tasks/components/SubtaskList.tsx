import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Square,
  CheckSquare,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Check,
  AlertCircle,
} from 'lucide-react'
import ConfirmDialog from '../../ui/ConfirmDialog'
import {
  addSubtask,
  deleteSubtask,
  renameSubtask,
  reorderSubtasks,
  setSubtaskCompleted,
} from '../services/tasksService'
import type { Subtask, TaskActor } from '../../../types/tasks'

interface Props {
  taskId: string
  subtasks: Subtask[]
  actor: TaskActor
  /** Creator, assignee or admin — the same set the RLS policies allow to write these rows. */
  canEdit: boolean
  onChange: () => void
}

/**
 * The checklist on a task's detail drawer.
 *
 * Local state is seeded from the prop and updated optimistically, then `onChange()` asks the
 * parent to refetch — the same shape AttachmentList uses. The optimism matters most on the
 * tick: the write goes to task_subtasks and the parent's `completed` is flipped by a trigger
 * on the way back, so waiting for the round trip would make every checkbox feel laggy.
 */
const SubtaskList: React.FC<Props> = ({ taskId, subtasks, actor, canEdit, onChange }) => {
  const { t } = useTranslation()
  const [items, setItems] = useState<Subtask[]>(subtasks)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Subtask | null>(null)

  useEffect(() => { setItems(subtasks) }, [subtasks])

  const done = items.filter(s => s.completed).length

  // Every mutation follows the same arc: flip local state, write, tell the parent to refetch,
  // and on failure fall back to the props we were given rather than guessing at the truth.
  // The message is surfaced rather than rethrown — several of these run from onBlur, where a
  // rejected promise would be swallowed by React and the tick would just snap back unexplained.
  const run = async (optimistic: Subtask[], write: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    setItems(optimistic)
    try {
      await write()
      onChange()
    } catch (e) {
      setItems(subtasks)
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  // Ticking deliberately does NOT take the busy lock, and ticks do not block each other.
  // Each one touches a different row's `completed`, so they cannot conflict, and someone
  // crossing off six lines in a row should not be made to wait out a write plus a refetch
  // between each tap. The optimistic flip is applied functionally rather than from the
  // captured `items`, so two fast taps cannot lose each other to a stale closure.
  //
  // Structural edits below still serialise through run(): those renumber positions and
  // genuinely do conflict.
  const toggle = async (s: Subtask) => {
    const next = !s.completed
    setError(null)
    setItems(prev => prev.map(i => (i.id === s.id ? { ...i, completed: next } : i)))
    try {
      await setSubtaskCompleted(taskId, s.id, next, actor, undefined, s.title)
      onChange()
    } catch (e) {
      setItems(prev => prev.map(i => (i.id === s.id ? { ...i, completed: !next } : i)))
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  const add = async () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    await run(items, () => addSubtask(taskId, title, items.length, actor))
  }

  const commitRename = async (s: Subtask) => {
    const title = editDraft.trim()
    setEditingId(null)
    if (!title || title === s.title) return
    await run(
      items.map(i => (i.id === s.id ? { ...i, title } : i)),
      () => renameSubtask(taskId, s.id, title, actor),
    )
  }

  const move = async (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    await run(next, () => reorderSubtasks(taskId, next.map(s => s.id), actor))
  }

  const confirmDelete = async () => {
    const s = pendingDelete
    setPendingDelete(null)
    if (!s) return
    await run(
      items.filter(i => i.id !== s.id),
      () => deleteSubtask(taskId, s.id, actor, undefined, s.title),
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('tasks.subtasks.label')}
        </div>
        {items.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {t('tasks.subtasks.progress', { done, total: items.length })}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {items.map((s, index) => (
          <div key={s.id} className="group flex items-start gap-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => toggle(s)}
              className={`flex-shrink-0 mt-0.5 transition-colors ${
                s.completed
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'
              } disabled:cursor-not-allowed disabled:opacity-50`}
              title={s.completed ? t('tasks.row.mark_open') : t('tasks.row.mark_done')}
            >
              {s.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </button>

            {editingId === s.id && canEdit ? (
              <div className="flex-1 flex gap-2">
                <input
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(s) }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
                  }}
                  autoFocus
                  className="flex-1 px-2 py-1 text-base border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => commitRename(s)}
                  disabled={busy}
                  className="px-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                  title={t('common.save')}
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <span
                onClick={() => {
                  if (!canEdit) return
                  setEditingId(s.id)
                  setEditDraft(s.title)
                }}
                className={`flex-1 min-w-0 text-base whitespace-pre-wrap break-words ${
                  s.completed
                    ? 'line-through text-gray-400 dark:text-gray-500'
                    : 'text-gray-700 dark:text-gray-200'
                } ${canEdit ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded px-1 -mx-1' : ''}`}
              >
                {s.title}
              </span>
            )}

            {canEdit && editingId !== s.id && (
              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={busy || index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                  title={t('tasks.subtasks.move_up')}
                  aria-label={t('tasks.subtasks.move_up')}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={busy || index === items.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                  title={t('tasks.subtasks.move_down')}
                  aria-label={t('tasks.subtasks.move_down')}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(s)}
                  disabled={busy}
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

        {items.length === 0 && !canEdit && (
          <div className="text-base text-gray-400 italic">{t('tasks.subtasks.none')}</div>
        )}

        {canEdit && (
          <div className="flex items-center gap-2 pt-1">
            <Plus className="w-5 h-5 flex-shrink-0 text-gray-400" />
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); add() }
              }}
              onBlur={add}
              disabled={busy}
              placeholder={t('tasks.subtasks.add_placeholder')}
              className="flex-1 px-2 py-1 text-base bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          {t('tasks.subtasks.governs_task')}
        </div>
      )}

      <ConfirmDialog
        show={!!pendingDelete}
        title={t('tasks.subtasks.remove_confirm_title')}
        message={t('tasks.subtasks.remove_confirm_message', { title: pendingDelete?.title || '' })}
        variant="danger"
        confirmLabel={t('tasks.subtasks.remove')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

export default SubtaskList
