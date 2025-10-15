import React from 'react'
import { UnitStatus } from '../../types'

interface StatusFilterProps {
  activeStatus: UnitStatus
  onStatusChange: (status: UnitStatus) => void
}

const statusOptions: { value: UnitStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' }
]

export function StatusFilter({ activeStatus, onStatusChange }: StatusFilterProps) {
  return (
    <div className="flex items-center space-x-4 mb-6">
      <span className="text-sm font-medium text-gray-700">Filter by status:</span>
      <div className="flex space-x-2">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onStatusChange(option.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              activeStatus === option.value
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
