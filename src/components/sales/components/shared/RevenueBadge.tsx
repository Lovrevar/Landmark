import React from 'react'

interface RevenueBadgeProps {
  amount: number
  label?: string
}

export function RevenueBadge({ amount, label = 'Revenue' }: RevenueBadgeProps) {
  return (
    <div className="border-t pt-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="font-bold text-green-600">€{amount.toLocaleString()}</span>
      </div>
    </div>
  )
}
