import React from 'react'
import { ClipboardCheck, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { WorkLog } from '../types/supervisionTypes'

interface Props {
  weekLogs: WorkLog[]
}

const SupervisionWeekView: React.FC<Props> = ({ weekLogs }) => {
  const { t } = useTranslation()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
          <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
          {t('dashboards.supervision.week_logs_title', { count: weekLogs.length })}
        </h2>
      </div>
      <div className="p-6">
        {weekLogs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">{t('dashboards.supervision.no_work_logs')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboards.supervision.work_logs_appear')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {weekLogs.map((log) => (
              <div
                key={log.id}
                className="border-l-4 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
                style={{ borderLeftColor: log.color || 'blue' }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{log.subcontractor_name}</h3>
                    {log.contracts && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('dashboards.supervision.contract_label')} {log.contracts.contract_number} - {log.contracts.job_description}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{log.work_description}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-semibold">
                    {format(new Date(log.created_at), 'HH:mm')}
                  </span>
                </div>
                {log.blocker_details && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg mb-3">
                    <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">{t('dashboards.supervision.issue_details')}</p>
                    <p className="text-sm text-red-700 dark:text-red-400">{log.blocker_details}</p>
                  </div>
                )}
                {log.notes && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">{t('dashboards.supervision.notes_label')}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{log.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SupervisionWeekView
