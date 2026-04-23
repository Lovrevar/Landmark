import React from 'react'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  compact?: boolean
  value?: string | number | readonly string[] | null
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  compact = false,
  className = '',
  value,
  ...props
}, ref) => {
  const baseClasses = [
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg',
    'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    compact ? 'px-3 py-1.5 text-sm' : 'px-3 py-2',
    className,
  ].filter(Boolean).join(' ')

  const handleFocus = props.type === 'number'
    ? (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select()
        props.onFocus?.(e)
      }
    : props.onFocus

  const handleWheel = props.type === 'number'
    ? (e: React.WheelEvent<HTMLInputElement>) => {
        e.currentTarget.blur()
        props.onWheel?.(e)
      }
    : props.onWheel

  return <input ref={ref} className={baseClasses} value={value ?? undefined} {...props} onFocus={handleFocus} onWheel={handleWheel} />
})

Input.displayName = 'Input'

export default Input
