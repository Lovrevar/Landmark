import React from 'react'

type SpinnerSize = 'sm' | 'md' | 'lg'

const sizeStyles: Record<SpinnerSize, { spinner: string; text: string }> = {
  sm: { spinner: 'h-6 w-6', text: 'text-sm' },
  md: { spinner: 'h-12 w-12', text: 'text-base' },
  lg: { spinner: 'h-16 w-16', text: 'text-lg' },
}

const heightStyles: Record<SpinnerSize, string> = {
  sm: 'h-32',
  md: 'h-64',
  lg: 'h-96',
}

interface LoadingSpinnerProps {
  size?: SpinnerSize
  message?: string
  className?: string
  inline?: boolean
}

export default function LoadingSpinner({
  size = 'md',
  message,
  className = '',
  inline = false,
}: LoadingSpinnerProps) {
  const cfg = sizeStyles[size]

  if (inline) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`animate-spin rounded-full ${cfg.spinner} border-b-2 border-blue-600`} />
        {message && <span className={`text-gray-600 ${cfg.text}`}>{message}</span>}
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center ${heightStyles[size]} ${className}`}>
      <div className="text-center">
        <div className={`animate-spin rounded-full ${cfg.spinner} border-b-2 border-blue-600 mx-auto`} />
        {message && <p className={`mt-4 text-gray-600 ${cfg.text}`}>{message}</p>}
      </div>
    </div>
  )
}
