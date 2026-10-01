import React from 'react'
import { AlertTriangle, Clock, Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatEuro } from '../../../utils/formatters'
import type { Alert } from '../types/directorTypes'

interface Props {
  alerts: Alert[]
}

const DirectorAlertsSection: React.FC<Props> = ({ alerts }) => {
  const { t } = useTranslation()
  if (alerts.length === 0) return null

  // The service hands over `{ kind, params }`; the words and the money formatting live here.
  // `name` falls back per kind, because an unnamed milestone or credit must not render as a
  // gap in the middle of a sentence.
  const alertText = (alert: Alert): { title: string; message: string } => {
    const params: Record<string, string | number> = { ...alert.params }
    if (alert.kind === 'overdue_milestone' || alert.kind === 'urgent_deadline') {
      params.name = alert.params?.name || t('dashboards.director.alerts.milestone_fallback')
    }
    if (alert.kind === 'credit_maturity') {
      params.name = alert.params?.name || t('dashboards.director.alerts.credit_fallback')
      params.amount = formatEuro(Number(alert.params?.amount ?? 0))
    }
    // "dospijeva za 0 dana" is exactly the sort of wording this batch exists to remove.
    const dueToday = alert.params?.count === 0 &&
      (alert.kind === 'urgent_deadline' || alert.kind === 'credit_maturity')
    return {
      title: t(`dashboards.director.alerts.${alert.kind}.title`),
      message: dueToday
        ? t(`dashboards.director.alerts.${alert.kind}.message_today`, params)
        : t(`dashboards.director.alerts.${alert.kind}.message`, params)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.director.critical_alerts', { count: alerts.length })}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.slice(0, 6).map((alert, index) => {
          const { title, message } = alertText(alert)
          return (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              alert.type === 'critical'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : alert.type === 'warning'
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
            }`}
          >
            <div className="flex items-start">
              {alert.type === 'critical' ? (
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
              ) : alert.type === 'warning' ? (
                <Clock className="w-5 h-5 text-orange-600 mr-2 mt-0.5" />
              ) : (
                <Activity className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold text-sm ${
                  alert.type === 'critical' ? 'text-red-900 dark:text-red-300' :
                  alert.type === 'warning' ? 'text-orange-900 dark:text-orange-300' : 'text-blue-900 dark:text-blue-100'
                }`}>
                  {title}
                </p>
                <p className={`text-xs mt-1 ${
                  alert.type === 'critical' ? 'text-red-700 dark:text-red-400' :
                  alert.type === 'warning' ? 'text-orange-700 dark:text-orange-400' : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {message}
                </p>
              </div>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}

export default DirectorAlertsSection
