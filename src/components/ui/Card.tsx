import React from 'react'

type CardVariant = 'default' | 'bordered' | 'elevated'

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700',
  bordered: 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
  elevated: 'bg-white dark:bg-gray-800 rounded-xl shadow-md',
}

interface CardProps {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

function CardRoot({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  onClick,
}: CardProps) {
  const classes = [
    variantStyles[variant],
    paddingStyles[padding],
    onClick ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
}

function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  )
}

interface CardBodyProps {
  children: React.ReactNode
  className?: string
}

function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={className}>{children}</div>
}

const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
})

export default Card
