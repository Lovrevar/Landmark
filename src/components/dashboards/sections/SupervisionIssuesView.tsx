import React from 'react'
import { XCircle, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { SubcontractorStatus } from '../types/supervisionTypes'

interface Props {
  overdueTasks: SubcontractorStatus[]
  criticalDeadlines: SubcontractorStatus[]
  needsAttention: SubcontractorStatus[]
}

const SupervisionIssuesView: React.FC<Props> = ({ overdueTasks, criticalDeadlines, needsAttention }) => {
  const allClear = overdueTasks.length === 0 && criticalDeadlines.length === 0 && needsAttention.length === 0

  return (
    <div className="space-y-6">
      {overdueTasks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200">
          <div className="p-6 border-b border-red-200 bg-red-50">
            <h2 className="text-xl font-semibold text-red-900 flex items-center">
              <XCircle className="w-5 h-5 mr-2" />
              Overdue Tasks ({overdueTasks.length})
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {overdueTasks.map((sub) => (
              <div key={sub.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{sub.project_name}</p>
                    <p className="text-sm text-red-600 font-medium mt-2">
                      {Math.abs(sub.days_until_deadline)} days overdue • {sub.progress}% complete
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">Deadline was</p>
                    <p className="text-sm font-medium text-red-700">
                      {format(parseISO(sub.deadline), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {criticalDeadlines.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-orange-200">
          <div className="p-6 border-b border-orange-200 bg-orange-50">
            <h2 className="text-xl font-semibold text-orange-900 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Critical Deadlines - Next 7 Days ({criticalDeadlines.length})
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {criticalDeadlines.map((sub) => (
              <div key={sub.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{sub.project_name}</p>
                    <p className="text-sm text-orange-600 font-medium mt-2">
                      {sub.days_until_deadline} days remaining • {sub.progress}% complete
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">Due</p>
                    <p className="text-sm font-medium text-orange-700">
                      {format(parseISO(sub.deadline), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-yellow-200">
          <div className="p-6 border-b border-yellow-200 bg-yellow-50">
            <h2 className="text-xl font-semibold text-yellow-900 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              No Recent Activity ({needsAttention.length})
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {needsAttention.map((sub) => (
              <div key={sub.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{sub.project_name}</p>
                    <p className="text-sm text-yellow-600 font-medium mt-2">
                      No work logs this week • {sub.progress}% complete
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">Last activity</p>
                    <p className="text-sm font-medium text-yellow-700">
                      {sub.last_activity ? format(parseISO(sub.last_activity), 'MMM dd') : 'None'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allClear && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clear!</h3>
          <p className="text-gray-600">No critical issues or alerts at this time</p>
        </div>
      )}
    </div>
  )
}

export default SupervisionIssuesView
