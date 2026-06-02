/* eslint-disable react-refresh/only-export-components */
// Co-locates ToastProvider with the useToast hook (idiomatic context pattern);
// the mixed-exports warning is a fast-refresh DX concern, not correctness.
import React, { createContext, useCallback, useContext, useState, useMemo } from 'react'
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
  const addToast = ctx?.addToast
  const dismiss = ctx?.dismiss
  // Memoised so the returned object is referentially stable across renders —
  // addToast/dismiss are useCallback-stable, so consumers can safely list the
  // returned helpers in useEffect/useCallback dependency arrays.
  const api = useMemo(() => {
    if (!addToast || !dismiss) return null
    return {
      toast:   (msg: string) => addToast(msg, 'info'),
      success: (msg: string) => addToast(msg, 'success'),
      error:   (msg: string) => addToast(msg, 'error'),
      warning: (msg: string) => addToast(msg, 'warning'),
      dismiss,
    }
  }, [addToast, dismiss])
  if (!api) throw new Error('useToast must be used within ToastProvider')
  return api
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
