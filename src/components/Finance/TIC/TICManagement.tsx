import React from 'react'
import { Briefcase } from 'lucide-react'

const TICManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">TIC Management</h2>
          <p className="text-gray-600 mt-1">Manage TIC operations and tracking</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">TIC Management</h3>
        <p className="text-gray-600">TIC functionality will be implemented here</p>
      </div>
    </div>
  )
}

export default TICManagement
