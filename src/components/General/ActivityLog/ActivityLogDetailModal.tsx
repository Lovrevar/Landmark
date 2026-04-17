import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import type { ActivityLogEntry } from './types'
import { ENTITY_ROUTE_MAP } from './types'

interface Props {
  log: ActivityLogEntry
  onClose: () => void
}

const SEVERITY_VARIANT: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
}

const METADATA_SKIP_KEYS = new Set(['severity'])

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return JSON.stringify(value)
}

const ActivityLogDetailModal: React.FC<Props> = ({ log, onClose }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const severity = (log.metadata?.severity as string) || 'low'

  const metadataEntries = Object.entries(log.metadata).filter(
    ([key]) => !METADATA_SKIP_KEYS.has(key)
  )

  const entityRoute = ENTITY_ROUTE_MAP[log.entity]
  const canNavigateToEntity = entityRoute && log.entity_id

  return (
    <Modal show onClose={onClose} size="md">
      <Modal.Header
        title={t(`activity_log.actions.${log.action}`, log.action)}
        subtitle={formatTimestamp(log.created_at)}
        onClose={onClose}
      />
      <Modal.Body>
        {/* User info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            {t('activity_log.detail_user')}
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('activity_log.detail_username')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{log.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('activity_log.detail_role')}</span>
              <Badge variant="blue" size="sm">{log.user_role}</Badge>
            </div>
          </div>
        </div>

        {/* Entity info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            {t('activity_log.detail_entity')}
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('activity_log.detail_entity_type')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{log.entity}</span>
            </div>
            {log.entity_id && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">ID</span>
                <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{log.entity_id}</span>
              </div>
            )}
            {log.project_name && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('activity_log.detail_project')}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{log.project_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('activity_log.col_severity')}</span>
              <Badge variant={SEVERITY_VARIANT[severity] || 'gray'} size="sm">
                {t(`activity_log.severity.${severity}`, severity)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Metadata */}
        {metadataEntries.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t('activity_log.detail_metadata')}
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{key}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white max-w-[60%] text-right break-words">
                    {formatMetadataValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {canNavigateToEntity && (
          <Button
            variant="secondary"
            onClick={() => {
              onClose()
              navigate(entityRoute)
            }}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            {t('activity_log.view_entity')}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default ActivityLogDetailModal
