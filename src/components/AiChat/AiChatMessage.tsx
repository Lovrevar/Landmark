import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  RotateCcw,
  Square,
  XCircle,
} from 'lucide-react'
import MarkdownView from '../ui/MarkdownView'
import type { RenderMessage } from './lib/normalizeMessages'
import { errorLabel, toolLabel } from './lib/labels'
import { useAiChat } from './AiChatProvider'
import { useAutoGrowTextarea } from './hooks/useAutoGrowTextarea'
import MessageAttachment from './components/MessageAttachment'

interface AiChatMessageProps {
  message: RenderMessage
  isLastAssistant?: boolean
}

const EDIT_MAX_HEIGHT_PX = 144

export default function AiChatMessage({ message, isLastAssistant }: AiChatMessageProps) {
  const {
    isStreaming,
    currentSessionId,
    editMessage,
    regenerateLastTurn,
    switchToLeaf,
  } = useAiChat()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const editRef = useRef<HTMLTextAreaElement>(null)

  useAutoGrowTextarea(editRef, draft, EDIT_MAX_HEIGHT_PX)

  useEffect(() => {
    if (!editing) return
    const ta = editRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }, [editing])

  switch (message.kind) {
    case 'user': {
      const canEdit = !isStreaming && currentSessionId !== null

      if (editing) {
        const handleSave = () => {
          const trimmed = draft.trim()
          if (!trimmed) return
          void editMessage(message.id, trimmed)
          setEditing(false)
        }
        const handleCancel = () => {
          setEditing(false)
        }
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            handleCancel()
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleSave()
          }
        }

        return (
          <div className="flex justify-end">
            <div className="max-w-[80%] w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-2">
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="w-full resize-none overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1 text-xs rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={draft.trim().length === 0}
                  className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
                >
                  Spremi
                </button>
              </div>
            </div>
          </div>
        )
      }

      const branch = message.branch
      const attachments = message.attachments ?? []
      return (
        <div className="flex flex-col items-end gap-1">
          <div className="group flex justify-end items-start gap-1 w-full">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setDraft(message.text)
                  setEditing(true)
                }}
                aria-label="Uredi poruku"
                title="Uredi poruku"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="max-w-[80%] bg-blue-600 text-white rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words">
              {message.text || <span className="opacity-70 italic">(prilog)</span>}
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end max-w-[80%]">
              {attachments.map((a) => (
                <MessageAttachment key={a.id} attachment={a} />
              ))}
            </div>
          )}
          {branch && branch.siblingCount > 1 && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 pr-1">
              <button
                type="button"
                onClick={() => {
                  if (branch.prevSiblingLeafId) switchToLeaf(branch.prevSiblingLeafId)
                }}
                disabled={!branch.prevSiblingLeafId || isStreaming}
                aria-label="Prethodna verzija"
                title="Prethodna verzija"
                className="p-0.5 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="tabular-nums">
                {branch.siblingIndex + 1}/{branch.siblingCount}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (branch.nextSiblingLeafId) switchToLeaf(branch.nextSiblingLeafId)
                }}
                disabled={!branch.nextSiblingLeafId || isStreaming}
                aria-label="Sljedeća verzija"
                title="Sljedeća verzija"
                className="p-0.5 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )
    }

    case 'assistant': {
      const canRegenerate = !isStreaming && isLastAssistant === true
      return (
        <div className="group flex justify-start items-start gap-1">
          <div className="max-w-[90%] bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 overflow-hidden break-words">
            <MarkdownView content={message.text} />
          </div>
          {canRegenerate && (
            <button
              type="button"
              onClick={() => void regenerateLastTurn()}
              aria-label="Generiraj ponovno"
              title="Generiraj ponovno"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }

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

    case 'interrupted':
      return (
        <div className="flex items-center gap-2 text-xs italic text-gray-500 dark:text-gray-400 px-1 py-1">
          <Square className="w-3 h-3 fill-current flex-shrink-0" />
          <span>Odgovor prekinut.</span>
        </div>
      )
  }
}
