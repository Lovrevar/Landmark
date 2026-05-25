import React from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  subtitle?: string
  icon?: React.ElementType
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
