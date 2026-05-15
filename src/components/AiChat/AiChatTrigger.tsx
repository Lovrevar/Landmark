import { Sparkles } from 'lucide-react'
import { useAiChat } from './AiChatProvider'

export default function AiChatTrigger() {
  const { open, isOpen } = useAiChat()

  if (isOpen) return null

  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label="AI asistent"
      className="fixed z-50 bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors duration-200"
    >
      <Sparkles className="w-6 h-6" />
    </button>
  )
}
