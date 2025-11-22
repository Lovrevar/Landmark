import React from 'react'
import { Building2 } from 'lucide-react'

const AccountingCompanies: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Building2 className="w-16 h-16 text-gray-400" />
          <h2 className="text-2xl font-semibold text-gray-900">Moje firme</h2>
          <p className="text-gray-500 text-center max-w-md">
            Modul za upravljanje firmama je u pripremi.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AccountingCompanies
