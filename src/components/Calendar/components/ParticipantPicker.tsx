import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import type { TaskUser } from '../../../types/tasks'

interface Props {
  users: TaskUser[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  excludeId?: string | null
  placeholder?: string
  disabled?: boolean
}

export default function ParticipantPicker({
  users,
  selectedIds,
  onChange,
  excludeId,
  placeholder,
  disabled,
}: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const availableUsers = useMemo(
    () => users.filter(u => u.id !== excludeId),
    [users, excludeId]
  )

  const selectedUsers = useMemo(
    () => availableUsers.filter(u => selectedIds.includes(u.id)),
    [availableUsers, selectedIds]
  )

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return availableUsers
      .filter(u => !selectedIds.includes(u.id))
      .filter(u => !q || u.username.toLowerCase().includes(q) || (u.role && u.role.toLowerCase().includes(q)))
      .slice(0, 50)
  }, [availableUsers, selectedIds, query])

  const add = (id: string) => {
    if (disabled) return
    onChange([...selectedIds, id])
    setQuery('')
  }

  const remove = (id: string) => {
    if (disabled) return
    onChange(selectedIds.filter(x => x !== id))
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={[
          'min-h-[42px] w-full rounded-lg border bg-white dark:bg-gray-700',
          'border-gray-300 dark:border-gray-600',
          'px-2 py-1.5 flex flex-wrap items-center gap-1.5',
          disabled ? 'opacity-60' : '',
        ].join(' ')}
        onClick={() => !disabled && setOpen(true)}
      >
        {selectedUsers.map(u => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
          >
            {u.username}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(u.id) }}
              className="text-blue-700/70 hover:text-blue-900 dark:text-blue-200/70 dark:hover:text-blue-100"
              aria-label={t('common.remove')}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            placeholder={selectedUsers.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>
      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {candidates.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {t('calendar.modal.participant_no_results')}
            </div>
          ) : (
            candidates.map(u => (
              <button
                type="button"
                key={u.id}
                onClick={() => add(u.id)}
                className="w-full px-3 py-2 text-left text-sm flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="text-gray-900 dark:text-gray-100">{u.username}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{u.role}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
