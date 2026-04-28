import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Users, User, ArrowLeft, MessageCircle, Paperclip, X, FileText, Loader2 } from 'lucide-react'
import type { ChatConversation, ChatMessage } from '../../types/chat'
import MessageBubble, { DateSeparator } from './MessageBubble'
import LoadingSpinner from '../ui/LoadingSpinner'

const MAX_FILE_SIZE = 25 * 1024 * 1024

interface MessagePanelProps {
  conversation: ChatConversation | null
  messages: ChatMessage[]
  currentUserId: string
  loading: boolean
  sending: boolean
  onSendMessage: (content: string, file?: File | null) => Promise<void>
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

function getDisplayName(
  conv: ChatConversation,
  currentUserId: string,
  unknownLabel: string,
  chatLabel: string,
): string {
  if (conv.name) return conv.name
  const others = conv.participants
    .filter(p => p.user_id !== currentUserId)
    .map(p => p.user?.username || unknownLabel)
  return others.join(', ') || chatLabel
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const firstUnreadRef = useRef<HTMLDivElement>(null)
  const initialScrollConvIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const firstUnreadId = useMemo(() => {
    if (!conversation) return null
    const me = conversation.participants.find(p => p.user_id === currentUserId)
    const lastReadAt = me?.last_read_at
    if (!lastReadAt) return null
    const found = messages.find(
      m => m.sender_id !== currentUserId && m.created_at > lastReadAt,
    )
    return found?.id ?? null
  }, [conversation, currentUserId, messages])

  useEffect(() => {
    if (!conversation) {
      initialScrollConvIdRef.current = null
      return
    }
    if (loading) return

    if (initialScrollConvIdRef.current === conversation.id) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    if (messages.length === 0) return

    initialScrollConvIdRef.current = conversation.id

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (firstUnreadRef.current) {
          firstUnreadRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        }
      })
    })
  }, [conversation, loading, messages])

  useEffect(() => {
    if (conversation) {
      inputRef.current?.focus()
    }
  }, [conversation?.id])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setFileError(t('chat.file_too_large'))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setPendingFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearPendingFile = () => {
    setPendingFile(null)
    setFileError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    if (!inputValue.trim() && !pendingFile) return

    try {
      await onSendMessage(inputValue, pendingFile)
      setInputValue('')
      setPendingFile(null)
      setFileError(null)
    } catch (err) {
      const msg = err instanceof Error && err.message === 'FILE_TOO_LARGE'
        ? t('chat.file_too_large')
        : t('chat.send_failed')
      setFileError(msg)
    }
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

  const displayName = getDisplayName(conversation, currentUserId, t('chat.unknown_user'), t('chat.title'))
  const participantsLabel = t('chat.participants_count', { count: conversation.participants.length })
  const canSend = inputValue.trim() || pendingFile

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
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
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
              {participantsLabel}
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
                <div ref={msg.id === firstUnreadId ? firstUnreadRef : undefined}>
                  <MessageBubble
                    message={msg}
                    isOwn={msg.sender_id === currentUserId}
                    showSender={shouldShowSender(messages, idx, conversation.is_group)}
                  />
                </div>
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {pendingFile && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {pendingFile.name}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {formatFileSize(pendingFile.size)}
                </p>
              </div>
              <button
                onClick={clearPendingFile}
                className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {fileError && (
          <div className="px-4 pt-2">
            <p className="text-xs text-red-500">{fileError}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 px-4 py-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex-shrink-0 p-2.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>

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
            disabled={!canSend || sending}
            className="flex-shrink-0 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default MessagePanel
