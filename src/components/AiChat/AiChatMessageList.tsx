import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useAiChat } from './AiChatProvider'
import AiChatMessage from './AiChatMessage'
import { useHelpArticles } from '../Help/hooks/useHelpArticles'
import { starterQuestions } from './lib/starterQuestions'

export default function AiChatMessageList() {
  const { messages, loadingMessages, currentSessionId, isStreaming, sendMessage } = useAiChat()
  const { pathname } = useLocation()
  const { articles } = useHelpArticles()
  const starters = starterQuestions(articles, pathname)
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
        {/* Opening questions for the page behind the panel, so an empty box is not the only way
            in. They come from the help articles the assistant answers from. */}
        <div className="mt-4 flex flex-col items-stretch gap-2 w-full max-w-xs">
          {starters.map(question => (
            <button
              key={question}
              type="button"
              disabled={isStreaming}
              onClick={() => void sendMessage(question)}
              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
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
