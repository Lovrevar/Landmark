import React from 'react'
import { ErrorState } from '../ui'

interface DashboardErrorProps {
  onRetry?: () => void
}

/**
 * Shown when a dashboard's data fetch fails. Critical: a load error must never
 * be rendered as legitimate zeros on a financial dashboard — this makes the
 * failure explicit and offers a retry.
 *
 * Now a thin wrapper over the shared `ErrorState`, which was promoted out of here so list
 * pages and modals can make the same distinction. The wording (`common.load_error_*`,
 * `common.retry`) and the layout live there; the six dashboards keep this import.
 */
const DashboardError: React.FC<DashboardErrorProps> = ({ onRetry }) => (
  <ErrorState onRetry={onRetry} />
)

export default DashboardError
