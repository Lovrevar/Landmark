import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  compact?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  compact = false,
  className = '',
  ...props
}, ref) => {
  const baseClasses = [
    'w-full border border-gray-300 rounded-lg',
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    compact ? 'px-3 py-1.5 text-sm' : 'px-3 py-2',
    className,
  ].filter(Boolean).join(' ')

  return <input ref={ref} className={baseClasses} {...props} />
})

Input.displayName = 'Input'

export default Input
