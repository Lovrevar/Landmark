import { AlertCircle, Check, Loader2, XCircle } from 'lucide-react'
import MarkdownView from '../ui/MarkdownView'
import type { RenderMessage } from './lib/normalizeMessages'
import { errorLabel, toolLabel } from './lib/labels'

interface AiChatMessageProps {
  message: RenderMessage
}

export default function AiChatMessage({ message }: AiChatMessageProps) {
  switch (message.kind) {
    case 'user':
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-blue-600 text-white rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words">
            {message.text}
          </div>
        </div>
      )

    case 'assistant':
      return (
        <div className="flex justify-start">
          <div className="max-w-[90%] bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 overflow-hidden break-words">
            <MarkdownView content={message.text} />
          </div>
        </div>
      )

    case 'tool': {
      const label = toolLabel(message.tool)
      return (
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 px-1 py-1.5">
          {message.status === 'pending' && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span>{label}…</span>
            </>
          )}
          {message.status === 'done' && (
            <>
              <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <span>{label}</span>
            </>
          )}
          {message.status === 'error' && (
            <>
              <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>{label}</span>
            </>
          )}
        </div>
      )
    }

    case 'error':
      return (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 text-sm text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="break-words">{errorLabel(message.code, message.message)}</span>
        </div>
      )
  }
}
