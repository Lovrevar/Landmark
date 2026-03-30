import React from 'react'

type BadgeVariant =
  | 'green'
  | 'red'
  | 'yellow'
  | 'blue'
  | 'gray'
  | 'orange'
  | 'teal'
  | 'purple'
  | 'default'
  | 'success'
  | 'warning'

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
}

type BadgeSize = 'sm' | 'md'

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-xs',
}

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
  className?: string
}

export default function Badge({
  variant = 'gray',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const classes = [
    'inline-flex items-center font-semibold rounded-full whitespace-nowrap',
    variantStyles[variant],
    sizeStyles[size],
    className,
  ].filter(Boolean).join(' ')

  return <span className={classes}>{children}</span>
}
