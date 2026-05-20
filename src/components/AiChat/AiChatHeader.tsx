import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useAiChat } from './AiChatProvider'

export default function AiChatHeader() {
  const {
    sessions,
    loadingSessions,
    currentSessionId,
    newConversation,
    selectSession,
    renameSession,
    deleteSession,
    close,
  } = useAiChat()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const current = sessions.find((s) => s.id === currentSessionId) ?? null
  const currentLabel = current?.title?.trim() || (currentSessionId ? 'Bez naslova' : 'Novi razgovor')

  useEffect(() => {
    if (!dropdownOpen) return
    const onMouseDown = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setDropdownOpen(false)
        setRenamingId(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [dropdownOpen])

  useEffect(() => {
    if (!renamingId) return
    const input = renameInputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [renamingId])

  const handlePickNew = () => {
    newConversation()
    setDropdownOpen(false)
  }

  const handlePickSession = (id: string) => {
    void selectSession(id)
    setDropdownOpen(false)
  }

  const handleStartRename = (id: string, current: string | null) => {
    setRenameDraft(current ?? '')
    setRenamingId(id)
  }

  const handleCommitRename = (id: string) => {
    const trimmed = renameDraft.trim()
    if (trimmed) {
      void renameSession(id, trimmed)
    }
    setRenamingId(null)
  }

  const handleConfirmDelete = () => {
    if (deleteCandidate) {
      void deleteSession(deleteCandidate)
    }
    setDeleteCandidate(null)
    setDropdownOpen(false)
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <span className="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
        AI asistent
      </span>

      <div ref={containerRef} className="flex-1 min-w-0 relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((open) => !open)}
          disabled={loadingSessions}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-label="Razgovori"
          className="w-full flex items-center justify-between gap-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-gray-900 dark:text-gray-100 disabled:opacity-60 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <span className="truncate text-left">
            {loadingSessions ? 'Učitavanje...' : currentLabel}
          </span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1">
            <button
              type="button"
              onClick={handlePickNew}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novi razgovor</span>
            </button>

            {sessions.length > 0 && (
              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            )}

            {sessions.map((s) => {
              const isRenaming = renamingId === s.id
              const isCurrent = s.id === currentSessionId
              return (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1 px-2 py-1 text-sm ${
                    isCurrent ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCommitRename(s.id)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          setRenamingId(null)
                        }
                      }}
                      onBlur={() => handleCommitRename(s.id)}
                      className="flex-1 min-w-0 bg-white dark:bg-gray-700 border border-blue-400 dark:border-blue-500 rounded px-2 py-0.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePickSession(s.id)}
                        className="flex-1 min-w-0 truncate text-left px-1 py-0.5 text-gray-900 dark:text-gray-100 hover:underline"
                      >
                        {s.title || 'Bez naslova'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartRename(s.id, s.title)
                        }}
                        aria-label="Preimenuj razgovor"
                        title="Preimenuj"
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteCandidate(s.id)
                        }}
                        aria-label="Obriši razgovor"
                        title="Obriši"
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => close()}
        aria-label="Zatvori AI asistenta"
        className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <ConfirmDialog
        show={deleteCandidate !== null}
        title="Obriši razgovor?"
        message="Razgovor i sve poruke bit će trajno obrisani. Ova radnja se ne može poništiti."
        confirmLabel="Obriši"
        cancelLabel="Odustani"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  )
}
