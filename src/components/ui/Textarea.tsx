import React from 'react'

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
    'w-full border border-gray-300 rounded-lg',
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    compact ? 'px-3 py-1.5 text-sm' : 'px-3 py-2',
    className,
  ].filter(Boolean).join(' ')

  return <textarea ref={ref} className={baseClasses} rows={rows} {...props} />
})

Textarea.displayName = 'Textarea'

export default Textarea
