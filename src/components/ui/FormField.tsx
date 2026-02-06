import React from 'react'

interface FormFieldProps {
  label: string
  required?: boolean
  helperText?: string
  error?: string
  compact?: boolean
  children: React.ReactNode
  className?: string
}

export default function FormField({
  label,
  required = false,
  helperText,
  error,
  compact = false,
  children,
  className = '',
}: FormFieldProps) {
  const labelClasses = compact
    ? 'block text-xs font-medium text-gray-600 mb-1'
    : 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className={className}>
      <label className={labelClasses}>
        {label}{required ? ' *' : ''}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {!error && helperText && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
    </div>
  )
}
