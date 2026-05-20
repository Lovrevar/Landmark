import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useAiChat } from './AiChatProvider'
import AiChatMessage from './AiChatMessage'

export default function AiChatMessageList() {
  const { messages, loadingMessages, currentSessionId, isStreaming } = useAiChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    })
  }, [messages.length, isStreaming])

  if (loadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="md" inline />
      </div>
    )
  }

  if (messages.length === 0 && !currentSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <Sparkles className="w-10 h-10 opacity-40 text-gray-500 dark:text-gray-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pitajte me o projektima, izvođačima, računima ili plaćanjima.
        </p>
      </div>
    )
  }

  const showTypingIndicator =
    isStreaming && messages.length > 0 && messages[messages.length - 1].kind === 'user'

  // Index of the last assistant message — used to gate the regenerate button.
  let lastAssistantIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].kind === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {messages.map((m, i) => (
        <AiChatMessage key={m.id} message={m} isLastAssistant={i === lastAssistantIndex} />
      ))}
      {showTypingIndicator && (
        <div className="flex justify-start">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:300ms]" />
          </div>
        </div>
      )}
    </div>
  )
}
