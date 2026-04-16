import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Users, User, ArrowLeft, MessageCircle } from 'lucide-react'
import type { ChatConversation, ChatMessage } from '../../types/chat'
import MessageBubble, { DateSeparator } from './MessageBubble'
import LoadingSpinner from '../ui/LoadingSpinner'

interface MessagePanelProps {
  conversation: ChatConversation | null
  messages: ChatMessage[]
  currentUserId: string
  loading: boolean
  sending: boolean
  onSendMessage: (content: string) => void
  onBack?: () => void
}

function shouldShowDateSeparator(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].created_at).toDateString()
  const curr = new Date(messages[index].created_at).toDateString()
  return prev !== curr
}

function shouldShowSender(messages: ChatMessage[], index: number, isGroup: boolean): boolean {
  if (!isGroup) return false
  if (index === 0) return true
  return messages[index].sender_id !== messages[index - 1].sender_id
}

function getDisplayName(conv: ChatConversation, currentUserId: string): string {
  if (conv.name) return conv.name
  const others = conv.participants
    .filter(p => p.user_id !== currentUserId)
    .map(p => p.user?.username || 'Unknown')
  return others.join(', ') || 'Chat'
}

function getParticipantCount(conv: ChatConversation): string {
  return `${conv.participants.length} sudionika`
}

const MessagePanel: React.FC<MessagePanelProps> = ({
  conversation,
  messages,
  currentUserId,
  loading,
  sending,
  onSendMessage,
  onBack,
}) => {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (conversation) {
      inputRef.current?.focus()
    }
  }, [conversation?.id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || sending) return
    onSendMessage(inputValue)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900/50">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            {t('chat.select_conversation')}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {t('chat.select_conversation_desc')}
          </p>
        </div>
      </div>
    )
  }

  const displayName = getDisplayName(conversation, currentUserId)

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors lg:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400`}
        >
          {conversation.is_group ? (
            <Users className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {displayName}
          </p>
          {conversation.is_group && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {getParticipantCount(conversation)}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 bg-white dark:bg-gray-800/50">
        {loading ? (
          <LoadingSpinner size="sm" className="mt-8" />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 dark:text-gray-500">{t('chat.no_messages')}</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <React.Fragment key={msg.id}>
                {shouldShowDateSeparator(messages, idx) && (
                  <DateSeparator date={msg.created_at} />
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender_id === currentUserId}
                  showSender={shouldShowSender(messages, idx, conversation.is_group)}
                />
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.type_message')}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 overflow-y-auto"
          style={{ minHeight: '40px' }}
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || sending}
          className="flex-shrink-0 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

export default MessagePanel
