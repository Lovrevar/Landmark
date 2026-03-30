import React from 'react'

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

  return (
    <select ref={ref} className={baseClasses} {...props}>
      {children}
    </select>
  )
})

Select.displayName = 'Select'

export default Select
