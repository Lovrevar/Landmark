import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { ChatParticipant } from '../../types/chat'

interface GroupMembersPanelProps {
  participants: ChatParticipant[]
  currentUserId: string
  onClose: () => void
}

const GroupMembersPanel: React.FC<GroupMembersPanelProps> = ({
  participants,
  currentUserId,
  onClose,
}) => {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const sorted = [...participants].sort((a, b) => {
    if (a.user_id === currentUserId) return -1
    if (b.user_id === currentUserId) return 1
    return (a.user?.username || '').localeCompare(b.user?.username || '')
  })

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 right-0 sm:right-auto sm:left-4 sm:w-72 z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('chat.members', { count: participants.length })}
        </p>
        <button
          onClick={onClose}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <ul className="max-h-64 overflow-y-auto py-1">
        {sorted.map(p => {
          const name = p.user?.username || t('chat.unknown_user')
          const isMe = p.user_id === currentUserId
          return (
            <li
              key={p.id}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-semibold">
                {name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">
                  {name}
                  {isMe && (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                      ({t('chat.you')})
                    </span>
                  )}
                </p>
                {p.user?.role && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.user.role}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default GroupMembersPanel
