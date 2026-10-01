import React from 'react'
import { useFormFieldControl } from './FormField'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  compact?: boolean
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  compact = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = [
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg',
    'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100',
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

  return (
    <select ref={ref} className={baseClasses} {...props} {...a11y}>
      {children}
    </select>
  )
})

Select.displayName = 'Select'

export default Select
