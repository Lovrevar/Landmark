import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500 text-lg">{title}</p>
      {description && (
        <p className="text-gray-400 text-sm mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
