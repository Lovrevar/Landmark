import { useEffect } from 'react'
import { useAiChat } from './AiChatProvider'
import AiChatHeader from './AiChatHeader'
import AiChatMessageList from './AiChatMessageList'
import AiChatInput from './AiChatInput'

export default function AiChatPanel() {
  const { close } = useAiChat()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close])

  return (
    <div
      className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[min(70vh,700px)] flex flex-col bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700"
      role="dialog"
      aria-label="AI asistent"
    >
      <AiChatHeader />

      <div className="flex-1 overflow-hidden flex flex-col">
        <AiChatMessageList />
      </div>

      <AiChatInput />
    </div>
  )
}
