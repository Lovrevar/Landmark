import React from 'react'

interface StatusPillProps {
  status: 'Available' | 'Reserved' | 'Sold' | string
}

export function StatusPill({ status }: StatusPillProps) {
  const getStatusClasses = () => {
    switch (status) {
      case 'Sold':
        return 'bg-green-100 text-green-800'
      case 'Reserved':
        return 'bg-yellow-100 text-yellow-800'
      case 'Available':
        return 'bg-blue-100 text-blue-800'
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClasses()}`}>
      {status}
    </span>
  )
}
