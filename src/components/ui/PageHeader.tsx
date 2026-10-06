import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HelpCircle } from 'lucide-react'
import { useHelpArticleCount } from '../Help/hooks/useHelpArticles'
import { logHelpEvent } from '../../lib/helpEvents'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

/**
 * The "?" beside a page title. It only appears when the knowledge base has an article about the
 * current page for the user's role, so it never leads to an empty list.
 */
function PageHelpLink() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const count = useHelpArticleCount(pathname)
  if (count === 0) return null

  const label = t('help.page_link')
  return (
    <Link
      to={`/help?page=${encodeURIComponent(pathname)}`}
      // A new tab: the page being asked about may hold unsaved edits or a half-filled form, and
      // help is read next to the task, not instead of it.
      target="_blank"
      rel="noopener"
      onClick={() => logHelpEvent({ action: 'help.page_link_click', page: pathname })}
      title={label}
      aria-label={label}
      className="inline-flex align-middle ml-2 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
    >
      <HelpCircle className="w-5 h-5" aria-hidden="true" />
    </Link>
  )
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
