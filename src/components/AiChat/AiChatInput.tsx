import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useAiChat } from './AiChatProvider'

const MAX_HEIGHT_PX = 144

export default function AiChatInput() {
  const { sendMessage, inputDisabled, currentSessionId, loadingMessages } = useAiChat()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevLoadingRef = useRef(loadingMessages)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

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

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || inputDisabled) return
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

  const canSend = !inputDisabled && value.trim().length > 0

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-end gap-2">
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
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Pošalji"
        className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md p-2 transition-colors"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
