import React from 'react'
import PageHelpLink from './PageHelpLink'

interface PageHeaderProps {
  title: string
  description?: string
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
      {/* The title block keeps a readable width and the actions wrap around it. Before, the
          actions never shrank, so a page with five buttons squeezed its title and description
          into a ~90px column (Cashflow → Invoices at 1440px). */}
      <div className="min-w-0 sm:min-w-[14rem] sm:flex-1">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {title}
          <PageHelpLink />
        </h1>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:min-w-0">{actions}</div>}
    </div>
  )
}
