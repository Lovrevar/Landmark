import React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import EmptyState from './EmptyState'
import Button from './Button'

interface ErrorStateProps {
  /** Re-runs the failed load. Without it no retry button is shown. */
  onRetry?: () => void
  title?: string
  description?: string
  /** Tighter padding, for a card body, a modal or a panel inside a page. */
  compact?: boolean
  className?: string
}

/**
 * Shown when data could not be loaded.
 *
 * The distinction this exists to make: a failed query must never render as an empty list or as
 * legitimate zeros. "No invoices" and "we couldn't reach the server" look identical otherwise,
 * and on a financial screen that is the difference between "nothing to pay" and "we don't know".
 *
 * Use it in place of the list, keeping the page header and filters mounted, so the user keeps
 * their filters and can retry in place. Where stale data is still on screen, keep the data and
 * show an `Alert variant="error"` above it instead.
 */
const ErrorState: React.FC<ErrorStateProps> = ({ onRetry, title, description, compact = false, className = '' }) => {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title ?? t('common.load_error_title')}
      description={description ?? t('common.load_error_description')}
      action={onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : undefined}
      className={`${compact ? 'py-6' : ''} ${className}`.trim()}
    />
  )
}

export default ErrorState
