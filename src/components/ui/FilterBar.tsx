import React from 'react'

interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export default function FilterBar({
  children,
  className = '',
}: FilterBarProps) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-center ${className}`}>
      {children}
    </div>
  )
}
