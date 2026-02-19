import React from 'react'
import { AlertTriangle, Clock, Activity } from 'lucide-react'
import type { Alert } from '../types/directorTypes'

interface Props {
  alerts: Alert[]
}

const DirectorAlertsSection: React.FC<Props> = ({ alerts }) => {
  if (alerts.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Critical Alerts ({alerts.length})</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.slice(0, 6).map((alert, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              alert.type === 'critical'
                ? 'bg-red-50 border-red-200'
                : alert.type === 'warning'
                ? 'bg-orange-50 border-orange-200'
                : 'bg-blue-50 border-blue-200'
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
                  alert.type === 'critical' ? 'text-red-900' :
                  alert.type === 'warning' ? 'text-orange-900' : 'text-blue-900'
                }`}>
                  {alert.title}
                </p>
                <p className={`text-xs mt-1 ${
                  alert.type === 'critical' ? 'text-red-700' :
                  alert.type === 'warning' ? 'text-orange-700' : 'text-blue-700'
                }`}>
                  {alert.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DirectorAlertsSection
