import React from 'react'
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
  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full max-h-[90vh] flex flex-col`}>
        {children}
      </div>
    </div>
  )
}

interface ModalHeaderProps {
  title: string
  subtitle?: string
  onClose: () => void
  children?: React.ReactNode
}

function ModalHeader({ title, subtitle, onClose, children }: ModalHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start flex-shrink-0 rounded-t-lg">
      <div className="flex-1">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        {children}
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-4"
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
    noPadding ? '' : 'p-6 space-y-4',
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
    'bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 rounded-b-lg',
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
