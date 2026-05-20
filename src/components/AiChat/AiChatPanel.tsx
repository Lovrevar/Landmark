import { useEffect, useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { useAiChat } from './AiChatProvider'
import AiChatHeader from './AiChatHeader'
import AiChatMessageList from './AiChatMessageList'
import AiChatInput from './AiChatInput'
import { MAX_ATTACHMENTS_PER_MESSAGE } from './services/aiAttachmentsService'
import { UI_LABELS_HR } from './lib/labels'

export default function AiChatPanel() {
  const { close, addPendingAttachments, pendingAttachments, inputDisabled } = useAiChat()
  const [isDragging, setIsDragging] = useState(false)
  // dragenter/dragleave fire for every child element; track the depth so the
  // overlay only disappears when the cursor truly leaves the panel.
  const dragDepth = useRef(0)

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

  const canAcceptMore = pendingAttachments.length < MAX_ATTACHMENTS_PER_MESSAGE
  const acceptDrops = canAcceptMore && !inputDisabled

  const isFileDrag = (e: React.DragEvent): boolean =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files')

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e) || !acceptDrops) return
    e.preventDefault()
    dragDepth.current += 1
    setIsDragging(true)
  }
  const handleDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e) || !acceptDrops) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    if (!acceptDrops) return
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      addPendingAttachments(Array.from(files))
    }
  }

  return (
    <div
      className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[min(70vh,700px)] flex flex-col bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700"
      role="dialog"
      aria-label="AI asistent"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AiChatHeader />

      <div className="flex-1 overflow-hidden flex flex-col">
        <AiChatMessageList />
      </div>

      <AiChatInput />

      {isDragging && (
        <div className="absolute inset-0 z-10 sm:rounded-lg bg-blue-500/10 border-2 border-dashed border-blue-500 dark:border-blue-400 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-blue-700 dark:text-blue-300">
            <Paperclip className="w-8 h-8" />
            <span className="text-sm font-medium">{UI_LABELS_HR.dropOverlay}</span>
          </div>
        </div>
      )}
    </div>
  )
}
