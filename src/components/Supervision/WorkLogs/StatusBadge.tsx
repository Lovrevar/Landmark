import { useTranslation } from 'react-i18next'
import { Badge } from '../../ui'
import { statusConfigFor } from './workLogStatus'

/**
 * A work log's status as a badge. Takes a plain string, not `WorkLogStatus`, because the
 * Supervision dashboard reads the column untyped; an unknown or missing status renders as
 * "unknown" rather than crashing the list.
 */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const { t } = useTranslation()
  const config = statusConfigFor(status)
  const Icon = config.icon
  return (
    <Badge variant={config.variant}>
      <Icon className="w-3 h-3 mr-1" />
      {t(config.tKey)}
    </Badge>
  )
}
