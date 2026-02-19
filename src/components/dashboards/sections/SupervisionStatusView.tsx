import React from 'react'
import { TrendingUp, CheckCircle2, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { SubcontractorStatus } from '../types/supervisionTypes'

interface Props {
  subcontractorStatus: SubcontractorStatus[]
}

const getCardClass = (sub: SubcontractorStatus): string => {
  if (sub.is_overdue) return 'border-red-300 bg-red-50'
  if (sub.days_until_deadline <= 7 && sub.progress < 100) return 'border-orange-300 bg-orange-50'
  if (sub.progress === 100) return 'border-green-300 bg-green-50'
  return 'border-gray-200 bg-white'
}

const getProgressColor = (sub: SubcontractorStatus): string => {
  if (sub.progress === 100) return 'bg-green-600'
  if (sub.is_overdue) return 'bg-red-600'
  return 'bg-blue-600'
}

const getProgressTextColor = (sub: SubcontractorStatus): string => {
  if (sub.progress === 100) return 'text-green-600'
  if (sub.is_overdue) return 'text-red-600'
  return 'text-blue-600'
}

const SupervisionStatusView: React.FC<Props> = ({ subcontractorStatus }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="p-6 border-b border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center">
        <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
        Subcontractor Performance Overview
      </h2>
    </div>
    <div className="p-6">
      {subcontractorStatus.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No subcontractors found</p>
      ) : (
        <div className="space-y-3">
          {subcontractorStatus.map((sub) => (
            <div key={sub.id} className={`border rounded-lg p-4 ${getCardClass(sub)}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                    {sub.progress === 100 && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                    {sub.is_overdue && <XCircle className="w-5 h-5 text-red-600" />}
                  </div>
                  <p className="text-sm text-gray-600">{sub.project_name}</p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getProgressTextColor(sub)}`}>
                    {sub.progress}%
                  </div>
                  <p className="text-xs text-gray-500">Complete</p>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full ${getProgressColor(sub)}`}
                  style={{ width: `${sub.progress}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-gray-600">Deadline</p>
                  <p className={`text-sm font-medium ${
                    sub.is_overdue ? 'text-red-600' :
                    sub.days_until_deadline <= 7 ? 'text-orange-600' :
                    'text-gray-900'
                  }`}>
                    {format(parseISO(sub.deadline), 'MMM dd')}
                    {sub.is_overdue && <span className="ml-1">({Math.abs(sub.days_until_deadline)}d over)</span>}
                    {!sub.is_overdue && sub.days_until_deadline <= 7 && (
                      <span className="ml-1">({sub.days_until_deadline}d left)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Budget Used</p>
                  <p className="text-sm font-medium text-gray-900">
                    {sub.cost > 0 ? ((sub.budget_realized / sub.cost) * 100).toFixed(0) : 0}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Last Activity</p>
                  <p className="text-sm font-medium text-gray-900">
                    {sub.last_activity ? format(parseISO(sub.last_activity), 'MMM dd') : 'No logs'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Weekly Logs</p>
                  <p className="text-sm font-medium text-gray-900">{sub.recent_work_logs}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)

export default SupervisionStatusView
