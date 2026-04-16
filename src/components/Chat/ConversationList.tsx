import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Users, User, MessageCircle } from 'lucide-react'
import type { ChatConversation } from '../../types/chat'
import SearchInput from '../ui/SearchInput'
import LoadingSpinner from '../ui/LoadingSpinner'

interface ConversationListProps {
  conversations: ChatConversation[]
  activeConversationId: string | null
  currentUserId: string
  loading: boolean
  onSelect: (id: string) => void
  onNewConversation: () => void
}

function getConversationDisplayName(
  conv: ChatConversation,
  currentUserId: string,
): string {
  if (conv.name) return conv.name
  const others = conv.participants
    .filter(p => p.user_id !== currentUserId)
    .map(p => p.user?.username || 'Unknown')
  return others.join(', ') || 'Chat'
}

function formatLastMessageTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'sada'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return d.toLocaleDateString('hr-HR', { day: 'numeric', month: 'short' })
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  currentUserId,
  loading,
  onSelect,
  onNewConversation,
}) => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const filtered = conversations.filter(c => {
    if (!search.trim()) return true
    const name = getConversationDisplayName(c, currentUserId).toLowerCase()
    return name.includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chat</h2>
          <button
            onClick={onNewConversation}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title={t('chat.new_conversation')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder={t('common.search')}
          className="w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingSpinner size="sm" className="mt-8" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {conversations.length === 0
                ? t('chat.no_conversations')
                : t('common.no_results')}
            </p>
          </div>
        ) : (
          filtered.map(conv => {
            const isActive = conv.id === activeConversationId
            const displayName = getConversationDisplayName(conv, currentUserId)
            const lastMsg = conv.last_message
            const lastMsgPreview = lastMsg
              ? `${lastMsg.sender_id === currentUserId ? t('chat.you') + ': ' : ''}${truncate(lastMsg.content, 40)}`
              : t('chat.no_messages')

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full px-4 py-3 flex items-start gap-3 transition-colors text-left border-b border-gray-100 dark:border-gray-700/50 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {conv.is_group ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm font-medium truncate ${
                        isActive
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {displayName}
                    </p>
                    {lastMsg && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                        {formatLastMessageTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {lastMsgPreview}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="flex-shrink-0 ml-2 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default ConversationList
