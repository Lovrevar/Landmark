import React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'

interface InlineLoadErrorProps {
  /** Already-translated sentence naming what failed. Defaults to the generic title. */
  message?: string
  /** Re-runs the failed load. Without it no retry link is shown. */
  onRetry?: () => void
  className?: string
}

/**
 * One line of "this could not be loaded", small enough to sit under a form control or inside a
 * sidebar card.
 *
 * `ErrorState` is the page- or list-sized version, for where a whole list would have been. This
 * is for the places where the alternative is a *control* that quietly reads as empty: a picker
 * whose options failed to load looks exactly like a picker whose value is "none", and a sidebar
 * widget with nothing in it looks exactly like "nothing is pending". Pair it with a disabled
 * control wherever the displayed value would otherwise contradict the value being saved.
 */
const InlineLoadError: React.FC<InlineLoadErrorProps> = ({ message, onRetry, className = '' }) => {
  const { t } = useTranslation()
  return (
    <p className={`flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 ${className}`.trim()}>
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>
        {message ?? t('common.load_error_title')}
        {onRetry && (
          <>
            {' '}
            <button
              type="button"
              onClick={onRetry}
              className="underline font-medium hover:no-underline"
            >
              {t('common.retry')}
            </button>
          </>
        )}
      </span>
    </p>
  )
}

export default InlineLoadError
