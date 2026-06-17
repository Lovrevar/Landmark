import React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { EmptyState, Button } from '../ui'

interface DashboardErrorProps {
  onRetry?: () => void
}

/**
 * Shown when a dashboard's data fetch fails. Critical: a load error must never
 * be rendered as legitimate zeros on a financial dashboard — this makes the
 * failure explicit and offers a retry.
 */
const DashboardError: React.FC<DashboardErrorProps> = ({ onRetry }) => {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t('dashboards.common.load_error_title')}
      description={t('dashboards.common.load_error_description')}
      action={onRetry ? <Button onClick={onRetry}>{t('dashboards.common.retry')}</Button> : undefined}
    />
  )
}

export default DashboardError
