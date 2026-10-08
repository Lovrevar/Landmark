import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HelpCircle } from 'lucide-react'
import { useHelpArticleCount } from '../Help/hooks/useHelpArticles'
import { logHelpEvent } from '../../lib/helpEvents'

interface PageHelpLinkProps {
  /** `light` for a title on a dark or coloured background (the General report's hero). */
  tone?: 'default' | 'light'
  className?: string
}

const TONES = {
  default: 'text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400',
  light: 'text-white/70 hover:text-white',
}

/**
 * The "?" beside a page title. It only appears when the knowledge base has an article about the
 * current page for the user's role, so it never leads to an empty list.
 *
 * `PageHeader` renders it for every page that uses the shared header. A page with a title of its
 * own (the dashboards, Budget Control, TIC, Tasks…) puts it inside that title, so the hardest
 * screens are not the ones without help.
 */
export default function PageHelpLink({ tone = 'default', className = '' }: PageHelpLinkProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const count = useHelpArticleCount(pathname)
  if (count === 0) return null

  const label = t('help.page_link')
  return (
    // The icon is an inline box, and a browser may break the line before one whatever precedes it,
    // so on a phone it used to wrap alone under a title that fills the line. A no-wrap span that
    // starts with a word joiner glues it to the last word of the title, which then wraps with it.
    <span className="whitespace-nowrap">
      {'\u2060'}
      <Link
        to={`/help?page=${encodeURIComponent(pathname)}`}
        // A new tab: the page being asked about may hold unsaved edits or a half-filled form, and
        // help is read next to the task, not instead of it.
        target="_blank"
        rel="noopener"
        onClick={() => logHelpEvent({ action: 'help.page_link_click', page: pathname })}
        title={label}
        aria-label={label}
        className={`inline-flex align-middle ml-2 ${TONES[tone]} ${className}`}
      >
        <HelpCircle className="w-5 h-5" aria-hidden="true" />
      </Link>
    </span>
  )
}
