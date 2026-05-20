import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send, Square } from 'lucide-react'
import { useAiChat } from './AiChatProvider'
import { useAutoGrowTextarea } from './hooks/useAutoGrowTextarea'
import AttachmentChip from './components/AttachmentChip'
import { ACCEPT_ATTR, MAX_ATTACHMENTS_PER_MESSAGE } from './services/aiAttachmentsService'
import { UI_LABELS_HR } from './lib/labels'

const MAX_HEIGHT_PX = 144

export default function AiChatInput() {
  const {
    sendMessage,
    stopStreaming,
    isStreaming,
    inputDisabled,
    currentSessionId,
    loadingMessages,
    pendingAttachments,
    addPendingAttachments,
    removePendingAttachment,
  } = useAiChat()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevLoadingRef = useRef(loadingMessages)

  useAutoGrowTextarea(textareaRef, value, MAX_HEIGHT_PX)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [currentSessionId])

  useEffect(() => {
    if (prevLoadingRef.current && !loadingMessages) {
      textareaRef.current?.focus()
    }
    prevLoadingRef.current = loadingMessages
  }, [loadingMessages])

  const attachmentCount = pendingAttachments.length
  const atAttachmentCap = attachmentCount >= MAX_ATTACHMENTS_PER_MESSAGE
  const anyUploading = pendingAttachments.some((p) => p.status === 'uploading')

  const trimmed = value.trim()
  const sendableAttachments = pendingAttachments.filter(
    (p) => p.status === 'pending' || p.status === 'uploaded',
  )
  const canSend = !inputDisabled
    && !anyUploading
    && (trimmed.length > 0 || sendableAttachments.length > 0)

  const handleSend = () => {
    if (!canSend) return
    void sendMessage(trimmed)
    setValue('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFilesPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return
    addPendingAttachments(Array.from(files))
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex flex-col gap-2">
      {attachmentCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pendingAttachments.map((p) => (
            <AttachmentChip
              key={p.id}
              attachment={p}
              disabled={p.status === 'uploading'}
              onRemove={() => void removePendingAttachment(p.id)}
            />
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={inputDisabled || atAttachmentCap}
          aria-label={UI_LABELS_HR.paperclipTooltip}
          title={atAttachmentCap ? UI_LABELS_HR.attachmentLimitReached : UI_LABELS_HR.paperclipTooltip}
          className="flex-shrink-0 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            handleFilesPicked(e.target.files)
            e.target.value = ''
          }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={inputDisabled}
          rows={1}
          placeholder="Pošaljite poruku..."
          className="flex-1 resize-none overflow-y-auto bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stopStreaming}
            aria-label="Zaustavi"
            className="flex-shrink-0 bg-gray-700 hover:bg-gray-800 text-white rounded-md p-2 transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Pošalji"
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md p-2 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
