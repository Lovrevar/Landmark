import React from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, FileSpreadsheet, Image as ImageIcon, File } from 'lucide-react'
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

function formatDateSeparator(
  dateStr: string,
  locale: string,
  todayLabel: string,
  yesterdayLabel: string,
): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return todayLabel
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string | null | undefined) {
  if (!mimeType) return File
  if (mimeType.startsWith('image/')) return ImageIcon
  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return FileSpreadsheet
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText
  return File
}

function isImageFile(mimeType: string | null | undefined): boolean {
  return !!mimeType && mimeType.startsWith('image/')
}

export function DateSeparator({ date }: { date: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'hr' ? 'hr-HR' : 'en-US'
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-2">
        {formatDateSeparator(date, locale, t('chat.today'), t('chat.yesterday'))}
      </span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

function FileAttachment({
  message,
  isOwn,
}: {
  message: ChatMessage
  isOwn: boolean
}) {
  const { t } = useTranslation()
  if (!message.file_url) return null

  const Icon = getFileIcon(message.file_type)
  const isImage = isImageFile(message.file_type)

  if (isImage) {
    return (
      <a
        href={message.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-1 mb-1"
      >
        <img
          src={message.file_url}
          alt={message.file_name || t('chat.image_fallback')}
          className="max-w-[240px] max-h-[200px] rounded-lg object-cover"
          loading="lazy"
        />
      </a>
    )
  }

  return (
    <a
      href={message.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2.5 mt-1 mb-1 px-3 py-2 rounded-lg transition-colors ${
        isOwn
          ? 'bg-blue-500/30 hover:bg-blue-500/40'
          : 'bg-gray-200/60 dark:bg-gray-600/40 hover:bg-gray-200 dark:hover:bg-gray-600/60'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${
        isOwn ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'
      }`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${
          isOwn ? 'text-white' : 'text-gray-800 dark:text-gray-200'
        }`}>
          {message.file_name || t('chat.file_fallback')}
        </p>
        {message.file_size && (
          <p className={`text-[10px] ${
            isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {formatFileSize(message.file_size)}
          </p>
        )}
      </div>
      <Download className={`w-3.5 h-3.5 flex-shrink-0 ${
        isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
      }`} />
    </a>
  )
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, showSender }) => {
  const { t } = useTranslation()
  const hasFile = !!message.file_url
  const hasText = !!message.content?.trim()

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showSender && !isOwn && (
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5 ml-3">
            {message.sender?.username || t('chat.unknown_user')}
          </p>
        )}
        <div
          className={`px-3.5 py-2 rounded-2xl ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }`}
        >
          {hasFile && <FileAttachment message={message} isOwn={isOwn} />}
          {hasText && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          )}
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
