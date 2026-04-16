import React from 'react'
import type { ChatMessage } from '../../types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  showSender: boolean
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Danas'
  if (d.toDateString() === yesterday.toDateString()) return 'Jucer'
  return d.toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-2">
        {formatDateSeparator(date)}
      </span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, showSender }) => {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showSender && !isOwn && (
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5 ml-3">
            {message.sender?.username || 'Unknown'}
          </p>
        )}
        <div
          className={`px-3.5 py-2 rounded-2xl ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
          <p
            className={`text-[10px] mt-0.5 ${
              isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
            } text-right`}
          >
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

export default MessageBubble
