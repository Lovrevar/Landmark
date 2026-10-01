import React from 'react'
import { useFormFieldControl } from './FormField'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  compact?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  compact = false,
  className = '',
  rows = 3,
  ...props
}, ref) => {
  const baseClasses = [
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg',
    'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    compact ? 'px-3 py-1.5 text-sm' : 'px-3 py-2',
    className,
  ].filter(Boolean).join(' ')

  const field = useFormFieldControl()
  // Inside a FormField, take its id (so the <label> points here) and its error/helper wiring.
  // Anything passed explicitly still wins.
  const a11y = field
    ? {
        id: props.id ?? field.controlId,
        'aria-describedby': props['aria-describedby'] ?? field.describedBy,
        'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
        'aria-required': props['aria-required'] ?? (field.required || undefined),
      }
    : {}

  return <textarea ref={ref} className={baseClasses} rows={rows} {...props} {...a11y} />
})

Textarea.displayName = 'Textarea'

export default Textarea
