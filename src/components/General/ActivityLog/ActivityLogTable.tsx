import React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import Table from '../../ui/Table'
import Badge from '../../ui/Badge'
import type { ActivityLogEntry } from './types'

interface Props {
  logs: ActivityLogEntry[]
  onViewDetail: (log: ActivityLogEntry) => void
}

const SEVERITY_VARIANT: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
}

const ROLE_VARIANT: Record<string, 'blue' | 'purple' | 'teal' | 'orange' | 'gray'> = {
  Director: 'blue',
  Accounting: 'purple',
  Sales: 'teal',
  Supervision: 'orange',
  Investment: 'gray',
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const ActivityLogTable: React.FC<Props> = ({ logs, onViewDetail }) => {
  const { t } = useTranslation()

  return (
    <Table>
      <Table.Head>
        <tr>
          <Table.Th>{t('activity_log.col_timestamp')}</Table.Th>
          <Table.Th>{t('activity_log.col_user')}</Table.Th>
          <Table.Th>{t('activity_log.col_action')}</Table.Th>
          <Table.Th>{t('activity_log.col_entity')}</Table.Th>
          <Table.Th>{t('activity_log.col_project')}</Table.Th>
          <Table.Th>{t('activity_log.col_severity')}</Table.Th>
          <Table.Th>{t('common.details')}</Table.Th>
        </tr>
      </Table.Head>
      <Table.Body>
        {logs.map((log) => {
          const severity = (log.metadata?.severity as string) || 'low'
          return (
            <Table.Tr key={log.id}>
              <Table.Td>
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {formatTimestamp(log.created_at)}
                </span>
              </Table.Td>
              <Table.Td>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.username}
                  </span>
                  <Badge variant={ROLE_VARIANT[log.user_role] || 'gray'} size="sm">
                    {log.user_role}
                  </Badge>
                </div>
              </Table.Td>
              <Table.Td>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {t(`activity_log.actions.${log.action}`, log.action)}
                </span>
              </Table.Td>
              <Table.Td>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {log.entity}
                  {log.entity_id && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                      ({log.entity_id.slice(0, 8)})
                    </span>
                  )}
                </span>
              </Table.Td>
              <Table.Td>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {log.project_name || '—'}
                </span>
              </Table.Td>
              <Table.Td>
                <Badge variant={SEVERITY_VARIANT[severity] || 'gray'} size="sm">
                  {t(`activity_log.severity.${severity}`, severity)}
                </Badge>
              </Table.Td>
              <Table.Td>
                <button
                  onClick={() => onViewDetail(log)}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title={t('common.details')}
                >
                  <Eye className="w-4 h-4" />
                </button>
              </Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Body>
    </Table>
  )
}

export default ActivityLogTable
