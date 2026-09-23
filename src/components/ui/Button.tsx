import React, { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { useFormSubmitting } from './Form'

type ButtonVariant =
  | 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'amber' | 'outline-danger' | 'emerald' | 'purple' | 'info' | 'outline'
  | 'ghost-primary' | 'ghost-success' | 'ghost-warning' | 'ghost-danger' | 'warning'

type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md' | 'icon-lg'

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  fullWidth?: boolean
  children?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
  ghost: 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
  amber: 'bg-amber-600 text-white hover:bg-amber-700',
  'outline-danger': 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
  purple: 'bg-purple-600 text-white hover:bg-purple-700',
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50',
  outline: 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600',
  // Transparent, coloured row actions (edit / pay / delete icons). Use these rather than
  // recolouring `ghost` through className: ghost's own `dark:text-gray-200` outranks a plain
  // `text-red-600`, so a red delete icon used to turn grey in dark mode.
  'ghost-primary': 'bg-transparent text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
  'ghost-success': 'bg-transparent text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
  'ghost-warning': 'bg-transparent text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
  'ghost-danger': 'bg-transparent text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
  // Soft yellow, the counterpart of `info`.
  warning: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/40',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3',
  'icon-sm': 'p-1',
  'icon-md': 'p-2',
  'icon-lg': 'p-3',
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  'icon-sm': 'w-4 h-4',
  'icon-md': 'w-4 h-4',
  'icon-lg': 'w-6 h-6',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  onClick,
  ...props
}, ref) => {
  const [asyncLoading, setAsyncLoading] = useState(false)
  const formSubmitting = useFormSubmitting()
  const isIconOnly = !children && (Icon || IconRight)
  const isLoading = loading || asyncLoading || (props.type === 'submit' && formSubmitting)
  const isDisabled = disabled || isLoading

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return
    const result = onClick(e) as unknown
    if (result instanceof Promise) {
      setAsyncLoading(true)
      result.finally(() => setAsyncLoading(false))
    }
  }

  const baseClasses = [
    'inline-flex items-center justify-center rounded-lg transition-colors duration-200',
    // Keyboard focus only (focus-visible), so mouse clicks show no ring.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantStyles[variant],
    sizeStyles[size],
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={baseClasses}
      onClick={onClick ? handleClick : undefined}
      {...props}
    >
      {isLoading && <Loader2 className={`${iconSizes[size]} animate-spin ${children ? 'mr-2' : ''}`} />}
      {!isLoading && Icon && <Icon className={`${iconSizes[size]} ${!isIconOnly ? 'mr-2' : ''}`} />}
      {children}
      {!isLoading && IconRight && <IconRight className={`${iconSizes[size]} ${!isIconOnly ? 'ml-2' : ''}`} />}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
