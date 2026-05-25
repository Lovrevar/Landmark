import React, { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

interface ModalProps {
  show: boolean
  onClose: () => void
  size?: ModalSize
  children: React.ReactNode
}

function ModalRoot({ show, onClose, size = 'md', children }: ModalProps) {
  const mouseDownOnBackdrop = useRef(false)

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [show])

  useEffect(() => {
    if (!show) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [show, onClose])

  if (!show) return null

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      mouseDownOnBackdrop.current = true
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
      onClose()
    }
    mouseDownOnBackdrop.current = false
  }

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${sizeClasses[size]} w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col`}>
        {children}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

interface ModalHeaderProps {
  title: string
  subtitle?: string | null
  onClose: () => void
  children?: React.ReactNode
}

function ModalHeader({ title, subtitle, onClose }: ModalHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex justify-between items-center gap-3 flex-shrink-0 rounded-t-lg">
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  )
}

interface ModalBodyProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

function ModalBody({ children, className = '', noPadding = false }: ModalBodyProps) {
  const baseClasses = [
    'overflow-y-auto flex-1',
    noPadding ? '' : 'p-4 sm:p-6 space-y-4',
    className,
  ].filter(Boolean).join(' ')

  return <div className={baseClasses}>{children}</div>
}

interface ModalFooterProps {
  children: React.ReactNode
  sticky?: boolean
}

function ModalFooter({ children, sticky = true }: ModalFooterProps) {
  const baseClasses = [
    'bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 rounded-b-lg',
    'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto',
    sticky ? 'sticky bottom-0' : '',
  ].filter(Boolean).join(' ')

  return <div className={baseClasses}>{children}</div>
}

const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
})

export default Modal
