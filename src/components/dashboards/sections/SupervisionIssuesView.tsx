import React from 'react'
import { XCircle, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { SubcontractorStatus } from '../types/supervisionTypes'

interface Props {
  overdueTasks: SubcontractorStatus[]
  criticalDeadlines: SubcontractorStatus[]
  needsAttention: SubcontractorStatus[]
}

const SupervisionIssuesView: React.FC<Props> = ({ overdueTasks, criticalDeadlines, needsAttention }) => {
  const { t } = useTranslation()
  const allClear = overdueTasks.length === 0 && criticalDeadlines.length === 0 && needsAttention.length === 0

  return (
    <div className="space-y-6">
      {overdueTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800">
          <div className="p-6 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-300 flex items-center">
              <XCircle className="w-5 h-5 mr-2" />
              {t('dashboards.supervision.overdue_tasks', { count: overdueTasks.length })}
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {overdueTasks.map((sub) => (
              <div key={sub.id} className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{sub.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sub.project_name}</p>
                    <p className="text-sm text-red-600 font-medium mt-2">
                      {t('dashboards.supervision.days_overdue', { days: Math.abs(sub.days_until_deadline) })} • {sub.progress}% {t('dashboards.supervision.complete')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('dashboards.supervision.deadline_was')}</p>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      {sub.deadline ? format(parseISO(sub.deadline), 'MMM dd, yyyy') : t('dashboards.supervision.na')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {criticalDeadlines.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-orange-200 dark:border-orange-800">
          <div className="p-6 border-b border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
            <h2 className="text-xl font-semibold text-orange-900 dark:text-orange-400 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              {t('dashboards.supervision.critical_deadlines', { count: criticalDeadlines.length })}
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {criticalDeadlines.map((sub) => (
              <div key={sub.id} className="border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{sub.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sub.project_name}</p>
                    <p className="text-sm text-orange-600 font-medium mt-2">
                      {t('dashboards.supervision.days_remaining', { days: sub.days_until_deadline })} • {sub.progress}% {t('dashboards.supervision.complete')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('dashboards.supervision.due')}</p>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      {sub.deadline ? format(parseISO(sub.deadline), 'MMM dd, yyyy') : t('dashboards.supervision.na')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-yellow-200 dark:border-yellow-800">
          <div className="p-6 border-b border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-400 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              {t('dashboards.supervision.no_recent_activity', { count: needsAttention.length })}
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {needsAttention.map((sub) => (
              <div key={sub.id} className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{sub.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sub.project_name}</p>
                    <p className="text-sm text-yellow-600 font-medium mt-2">
                      {t('dashboards.supervision.no_work_logs_week')} • {sub.progress}% {t('dashboards.supervision.complete')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('dashboards.supervision.last_activity_label')}</p>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                      {sub.last_activity ? format(parseISO(sub.last_activity), 'MMM dd') : t('dashboards.supervision.none')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allClear && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('dashboards.supervision.all_clear')}</h3>
          <p className="text-gray-600 dark:text-gray-400">{t('dashboards.supervision.no_critical_issues')}</p>
        </div>
      )}
    </div>
  )
}

export default SupervisionIssuesView
