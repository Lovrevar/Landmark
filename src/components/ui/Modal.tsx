import React, { createContext, useContext, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useFocusTrap } from '../../hooks/useFocusTrap'

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
  /** Accessible name for a modal that renders its own header instead of `Modal.Header`. */
  ariaLabel?: string
  children: React.ReactNode
}

// Carries the dialog's title id from the root to Modal.Header, which renders the title.
const ModalTitleContext = createContext<string | undefined>(undefined)

function ModalRoot({ show, onClose, size = 'md', ariaLabel, children }: ModalProps) {
  const mouseDownOnBackdrop = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

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

  useEscapeKey(show, onClose)
  useFocusTrap(panelRef, show)

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
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${sizeClasses[size]} w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col outline-none`}
      >
        <ModalTitleContext.Provider value={titleId}>
          {children}
        </ModalTitleContext.Provider>
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

function ModalHeader({ title, subtitle, onClose, children }: ModalHeaderProps) {
  const { t } = useTranslation()
  const titleId = useContext(ModalTitleContext)
  // Extra header content stacks under the title, so the close button pins to the top rather
  // than drifting to the middle of a taller header. Plain headers keep it centred on the title.
  const align = children ? 'items-start' : 'items-center'
  return (
    <div className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex justify-between ${align} gap-3 flex-shrink-0 rounded-t-lg`}>
      <div className="min-w-0">
        <h2 id={titleId} className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        title={t('common.close')}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
