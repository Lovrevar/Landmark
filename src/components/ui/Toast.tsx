import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'
import type { ToastItem } from '../../contexts/ToastContext'

const variantStyles: Record<string, string> = {
  info:    'bg-blue-600 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-500 text-white',
  error:   'bg-red-600 text-white',
}

const variantIcons = {
  info:    Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error:   AlertCircle,
}

function ToastEntry({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [shown, setShown] = useState(false)
  const Icon = variantIcons[toast.variant]

  // Two-frame trick: render off-screen first, then transition in
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 10)
    return () => clearTimeout(t)
  }, [])

  const visible = shown && toast.visible

  return (
    <div
      role="alert"
      onClick={() => onDismiss(toast.id)}
      className={[
        'flex items-start gap-3 w-80 rounded-lg shadow-lg px-4 py-3 cursor-pointer',
        'transform transition-all duration-300 ease-out',
        variantStyles[toast.variant],
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
      ].join(' ')}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <X className="w-4 h-4 flex-shrink-0 opacity-70 hover:opacity-100 mt-0.5" />
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts.length) return null

  return ReactDOM.createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastEntry toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body
  )
}
