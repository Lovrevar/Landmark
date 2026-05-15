import { X } from 'lucide-react'
import { useAiChat } from './AiChatProvider'

export default function AiChatHeader() {
  const {
    sessions,
    loadingSessions,
    currentSessionId,
    newConversation,
    selectSession,
    close,
  } = useAiChat()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === '__new__') {
      newConversation()
    } else {
      void selectSession(value)
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <span className="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
        AI asistent
      </span>

      <select
        value={currentSessionId ?? '__new__'}
        onChange={handleChange}
        disabled={loadingSessions}
        className="flex-1 min-w-0 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-gray-900 dark:text-gray-100 disabled:opacity-60"
        aria-label="Razgovori"
      >
        {loadingSessions && <option>Učitavanje...</option>}
        <option value="__new__">Novi razgovor</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title || 'Bez naslova'}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => close()}
        aria-label="Zatvori AI asistenta"
        className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
