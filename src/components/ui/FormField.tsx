import React, { useEffect, useRef } from 'react'

interface FormFieldProps {
  label: string
  required?: boolean
  helperText?: React.ReactNode
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
  const rootRef = useRef<HTMLDivElement>(null)

  const labelClasses = compact
    ? 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
    : 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  useEffect(() => {
    const node = rootRef.current
    if (!error || !node) return
    // Defer one frame so every sibling FormField has its data-form-error
    // attribute applied; querySelector then elects the first errored field
    // in DOM order — only that one actually scrolls.
    const id = requestAnimationFrame(() => {
      const first = document.querySelector('[data-form-error="true"]')
      if (first === node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [error])

  return (
    <div ref={rootRef} className={className} data-form-error={error ? 'true' : undefined}>
      <label className={labelClasses}>
        {label}{required ? ' *' : ''}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {!error && helperText && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>}
    </div>
  )
}
