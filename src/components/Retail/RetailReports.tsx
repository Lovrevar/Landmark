import React from 'react'
import { FileText } from 'lucide-react'

const RetailReports: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Izvještaji</h1>
        <p className="text-sm text-gray-600 mt-1">Izvještaji i analize za retail</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Izvještaji u razvoju
        </h3>
        <p className="text-gray-600">
          Ovdje će se nalaziti različiti izvještaji za retail modul
        </p>
      </div>
    </div>
  )
}

export default RetailReports
