import { useEffect } from 'react'
import { Loader2, Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { useToast } from '../../../contexts/ToastContext'
import { useVoiceCall } from '../hooks/useVoiceCall'

/** Call button in the AI chat header: talk to the assistant by voice. */
export default function VoiceCallButton() {
  const { state, muted, agentSpeaking, error, start, end, toggleMute } = useVoiceCall()
  const toast = useToast()

  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => void start()}
        aria-label="Glasovni poziv"
        title="Glasovni poziv"
        className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors"
      >
        <Phone className="w-5 h-5" />
      </button>
    )
  }

  if (state === 'connecting') {
    return (
      <span className="p-1 text-gray-500 dark:text-gray-400" role="status" aria-label="Spajanje poziva">
        <Loader2 className="w-5 h-5 animate-spin" />
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Glasovni poziv u tijeku">
      <span
        className={`w-2 h-2 rounded-full ${agentSpeaking ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => void toggleMute()}
        aria-label={muted ? 'Uključi mikrofon' : 'Isključi mikrofon'}
        title={muted ? 'Uključi mikrofon' : 'Isključi mikrofon'}
        aria-pressed={muted}
        className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors"
      >
        {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
      <button
        type="button"
        onClick={() => end()}
        aria-label="Završi poziv"
        title="Završi poziv"
        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-sm transition-colors"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  )
}
