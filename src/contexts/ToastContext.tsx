import React, { createContext, useCallback, useContext, useState } from 'react'
import ToastContainer from '../components/ui/Toast'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  visible: boolean
}

interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (message: string, variant?: ToastVariant) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return {
    toast:   (msg: string) => ctx.addToast(msg, 'info'),
    success: (msg: string) => ctx.addToast(msg, 'success'),
    error:   (msg: string) => ctx.addToast(msg, 'error'),
    warning: (msg: string) => ctx.addToast(msg, 'warning'),
    dismiss: ctx.dismiss,
  }
}

const DISMISS_DELAY = 4500
const ANIMATION_DURATION = 320

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    // Trigger slide-out animation, then remove from DOM
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ANIMATION_DURATION)
  }, [])

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, variant, visible: true }])
    setTimeout(() => dismiss(id), DISMISS_DELAY)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
