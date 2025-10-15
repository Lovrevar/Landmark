import React from 'react'

interface ProgressBarProps {
  current: number
  total: number
  label?: string
  showPercentage?: boolean
}

export function ProgressBar({ current, total, label, showPercentage = true }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="mb-4">
      {(label || showPercentage) && (
        <div className="flex justify-between mb-1">
          {label && <span className="text-sm text-gray-600">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-green-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}
