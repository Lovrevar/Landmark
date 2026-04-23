import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import type { TaskUser } from '../../../types/tasks'

interface Props {
  users: TaskUser[]
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  submitting?: boolean
  placeholder?: string
  rows?: number
  autoFocus?: boolean
}

interface MentionState {
  active: boolean
  query: string
  start: number
  cursor: number
}

const MentionPicker: React.FC<Props> = ({
  users,
  value,
  onChange,
  onSubmit,
  submitting,
  placeholder,
  rows = 2,
  autoFocus,
}) => {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<MentionState>({
    active: false,
    query: '',
    start: 0,
    cursor: 0,
  })
  const [hoverIndex, setHoverIndex] = useState(0)

  const filtered = useMemo(() => {
    if (!mention.active) return []
    const q = mention.query.trim().toLowerCase()
    return users
      .filter(u => !q || u.username.toLowerCase().includes(q))
      .slice(0, 8)
  }, [users, mention])

  useEffect(() => {
    setHoverIndex(0)
  }, [mention.query, mention.active])

  const detectMention = (text: string, caret: number): MentionState => {
    const before = text.slice(0, caret)
    const atIdx = before.lastIndexOf('@')
    if (atIdx < 0) return { active: false, query: '', start: 0, cursor: caret }
    const prevChar = atIdx === 0 ? ' ' : before[atIdx - 1]
    if (!/\s|[(,[{]/.test(prevChar) && atIdx !== 0) {
      return { active: false, query: '', start: 0, cursor: caret }
    }
    const between = before.slice(atIdx + 1)
    if (/\s/.test(between)) {
      return { active: false, query: '', start: 0, cursor: caret }
    }
    return { active: true, query: between, start: atIdx, cursor: caret }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    onChange(next)
    const caret = e.target.selectionStart ?? next.length
    setMention(detectMention(next, caret))
  }

  const handleSelectUser = (u: TaskUser) => {
    const before = value.slice(0, mention.start)
    const after = value.slice(mention.cursor)
    const token = `@[${u.username}](${u.id}) `
    const next = `${before}${token}${after}`
    onChange(next)
    setMention({ active: false, query: '', start: 0, cursor: 0 })
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const pos = before.length + token.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.active && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHoverIndex(i => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHoverIndex(i => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelectUser(filtered[hoverIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention({ active: false, query: '', start: 0, cursor: 0 })
        return
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="relative flex gap-2 items-end">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={rows}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {mention.active && filtered.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
            {filtered.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelectUser(u) }}
                onMouseEnter={() => setHoverIndex(i)}
                className={`w-full px-3 py-2 text-left text-sm flex justify-between items-center ${
                  i === hoverIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-gray-900 dark:text-gray-100">{u.username}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{u.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!value.trim() || submitting}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {t('tasks.detail.send_comment')}
      </button>
    </div>
  )
}

export default MentionPicker
