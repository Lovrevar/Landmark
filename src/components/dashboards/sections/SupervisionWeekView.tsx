import React from 'react'
import { ClipboardCheck, FileText } from 'lucide-react'
import { format } from 'date-fns'
import type { WorkLog } from '../types/supervisionTypes'

interface Props {
  weekLogs: WorkLog[]
}

const SupervisionWeekView: React.FC<Props> = ({ weekLogs }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="p-6 border-b border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center">
        <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
        This Week's Work Logs ({weekLogs.length})
      </h2>
    </div>
    <div className="p-6">
      {weekLogs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No work logs submitted this week</p>
          <p className="text-sm text-gray-500">Work logs will appear here as they are submitted</p>
        </div>
      ) : (
        <div className="space-y-4">
          {weekLogs.map((log) => (
            <div
              key={log.id}
              className="border-l-4 rounded-lg p-4 hover:shadow-md transition-shadow bg-white border border-gray-200"
              style={{ borderLeftColor: log.color || 'blue' }}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{log.subcontractor_name}</h3>
                  {log.contracts && (
                    <p className="text-xs text-gray-500 mb-1">
                      Contract: {log.contracts.contract_number} - {log.contracts.job_description}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-2">{log.work_description}</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  {format(new Date(log.created_at), 'HH:mm')}
                </span>
              </div>
              {log.blocker_details && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-3">
                  <p className="text-xs font-medium text-red-800 mb-1">Issue Details:</p>
                  <p className="text-sm text-red-700">{log.blocker_details}</p>
                </div>
              )}
              {log.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                  <p className="text-sm text-gray-600">{log.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)

export default SupervisionWeekView
