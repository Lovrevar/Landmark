import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'amber' | 'outline-danger' | 'emerald' | 'purple'

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
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
  ghost: 'text-gray-700 bg-gray-100 hover:bg-gray-200',
  amber: 'bg-amber-600 text-white hover:bg-amber-700',
  'outline-danger': 'text-red-600 bg-red-50 hover:bg-red-100',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
  purple: 'bg-purple-600 text-white hover:bg-purple-700',
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
  ...props
}, ref) => {
  const isIconOnly = !children && (Icon || IconRight)
  const isDisabled = disabled || loading

  const baseClasses = [
    'inline-flex items-center justify-center rounded-lg transition-colors duration-200',
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
      {...props}
    >
      {loading && <Loader2 className={`${iconSizes[size]} animate-spin ${children ? 'mr-2' : ''}`} />}
      {!loading && Icon && <Icon className={`${iconSizes[size]} ${!isIconOnly ? 'mr-2' : ''}`} />}
      {children}
      {!loading && IconRight && <IconRight className={`${iconSizes[size]} ${!isIconOnly ? 'ml-2' : ''}`} />}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
