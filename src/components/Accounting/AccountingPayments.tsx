import React from 'react'
import { DollarSign } from 'lucide-react'

const AccountingPayments: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <DollarSign className="w-16 h-16 text-gray-400" />
          <h2 className="text-2xl font-semibold text-gray-900">Plaćanja</h2>
          <p className="text-gray-500 text-center max-w-md">
            Modul za upravljanje plaćanjima je u pripremi.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AccountingPayments
